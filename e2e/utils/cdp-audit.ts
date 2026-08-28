import type { Page } from "@playwright/test";

export type AuditResult = {
  consoleErrors: string[];
  hydrationErrors: string[];
  failedRequests: { url: string; status: number }[];
  duplicateRequests: { url: string; count: number }[];
  metrics: Record<string, number>;
  longTasks: number;
};

export async function collectMetrics(
  session: import("@playwright/test").CDPSession,
) {
  try {
    const { metrics } = await session.send("Performance.getMetrics");
    const out: Record<string, number> = {};
    for (const m of metrics) out[m.name] = m.value;
    return out;
  } catch {
    return {};
  }
}

export async function attachCdpAudit(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: AuditResult["failedRequests"] = [];
  const reqCounts = new Map<string, number>();
  let longTasks = 0;

  const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // Playwright already filters to main world; keep all console.error
      if (t) consoleErrors.push(t);
    }
  };
  const onPageError = (err: Error) => consoleErrors.push(err.message);

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  // ponytail: single CDPSession per page; upgrade: per-page session is fine; fan-out or per-context session if CDP contention observed
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Runtime.enable");
  } catch {}
  try {
    await session.send("Log.enable");
  } catch {}
  try {
    await session.send("Network.enable");
  } catch {}
  try {
    await session.send("Performance.enable");
  } catch {}

  session.on(
    "Runtime.exceptionThrown",
    (p: {
      exceptionDetails: { text: string; exception?: { description?: string } };
    }) => {
      const d = p.exceptionDetails;
      const msg = d.exception?.description || d.text || "exception";
      consoleErrors.push(msg);
    },
  );
  session.on(
    "Log.entryAdded",
    (p: { entry: { level: string; text: string } }) => {
      if (p.entry.level === "error") consoleErrors.push(p.entry.text);
    },
  );
  session.on(
    "Network.responseReceived",
    (p: { response: { url: string; status: number } }) => {
      const { url, status } = p.response;
      if (status >= 400) failedRequests.push({ url, status });
      reqCounts.set(url, (reqCounts.get(url) || 0) + 1);
    },
  );
  session.on("Network.requestWillBeSent", (p: { request: { url: string } }) => {
    const url = p.request.url;
    // count duplicates for /api even before response
    if (url.includes("/api")) reqCounts.set(url, (reqCounts.get(url) || 0) + 1);
  });

  // best-effort long task via PerformanceObserver injected in page
  try {
    await page.evaluate(() => {
      try {
        // @ts-ignore
        const obs = new PerformanceObserver(
          (list: PerformanceObserverEntryList) => {
            // @ts-ignore
            window.__qaLongTasks =
              ((window as unknown as { __qaLongTasks?: number })
                .__qaLongTasks || 0) + list.getEntries().length;
          },
        );
        obs.observe({ entryTypes: ["longtask"] });
      } catch {}
    });
  } catch {}

  function getResult(): AuditResult {
    const hydrationErrors = consoleErrors.filter((m) => /hydrat/i.test(m));
    const duplicateRequests = [...reqCounts.entries()]
      .filter(([u, c]) => c > 1 && u.includes("/api"))
      .map(([url, count]) => ({ url, count }));
    return {
      consoleErrors,
      hydrationErrors,
      failedRequests,
      duplicateRequests,
      metrics: {},
      longTasks,
    };
  }

  async function getResultWithMetrics(): Promise<AuditResult> {
    const base = getResult();
    base.metrics = await collectMetrics(session);
    try {
      const v = await page.evaluate(
        () =>
          (window as unknown as { __qaLongTasks?: number }).__qaLongTasks || 0,
      );
      base.longTasks = v;
    } catch {
      base.longTasks = longTasks;
    }
    return base;
  }

  async function detach() {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    try {
      await session.detach();
    } catch {}
  }

  page.once("close", () => {
    void detach().catch(() => {});
  });
  page.once("crash", () => {
    void detach().catch(() => {});
  });

  return {
    session,
    getResult,
    getResultWithMetrics,
    collectMetrics: () => collectMetrics(session),
    detach,
  };
}
