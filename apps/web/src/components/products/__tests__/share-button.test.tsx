import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareButton } from "../share-button";

// `userEvent.setup()` installs its own real Clipboard implementation on
// `navigator.clipboard` (for its `.copy()`/`.paste()` support) — calling it
// AFTER these stubs would silently overwrite whatever mock a test just set
// up, so every test below calls `userEvent.setup()` first and stubs
// share/clipboard afterwards.
function stubShare(impl?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, "share", {
    value: impl ? vi.fn(impl) : undefined,
    configurable: true,
    writable: true,
  });
}

function stubClipboard(impl?: (text: string) => Promise<void>) {
  const writeText = vi.fn(impl ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("ShareButton", () => {
  const onCopied = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    onCopied.mockClear();
    onError.mockClear();
  });

  afterEach(() => {
    // Neither API exists in jsdom by default — leaving a stub behind would
    // leak into whichever test runs next in this file.
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("renders an accessible, labeled button before any interaction", () => {
    render(
      <ShareButton
        productId="p0"
        title="Chaqueta vintage"
        className="extra-class"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Compartir esta publicación",
    });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveClass("extra-class");
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  // Neither the Web Share API nor the Clipboard API is guaranteed on an old
  // browser — this must not throw uncaught, and should report the same
  // "couldn't copy" message as a real clipboard failure rather than crash.
  it("reports an error instead of throwing when neither the Web Share nor Clipboard API is available", async () => {
    const user = userEvent.setup();
    stubShare(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(
      <ShareButton
        productId="p5"
        title="Gorra"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /compartir/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("No pudimos copiar el enlace");
    });
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("uses the native share sheet when available, with the canonical product URL", async () => {
    const user = userEvent.setup();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    stubShare(shareMock);
    const writeTextMock = stubClipboard();

    render(
      <ShareButton
        productId="p1"
        title="Chaqueta vintage"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /compartir/i }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: "Chaqueta vintage",
        url: `${window.location.origin}/products/p1`,
      });
    });
    expect(writeTextMock).not.toHaveBeenCalled();
    expect(onCopied).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  // The visitor already made a choice via the native UI (dismissed the
  // sheet, or the OS refused it) — that isn't a failure of the click, so
  // there's nothing to report and no reason to also fall back to the
  // clipboard.
  it("stays silent when the native share sheet is dismissed or refused", async () => {
    const user = userEvent.setup();
    const shareMock = vi.fn().mockRejectedValue(new DOMException("AbortError"));
    stubShare(shareMock);
    stubClipboard();

    render(
      <ShareButton
        productId="p1"
        title="Chaqueta vintage"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /compartir/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    expect(onCopied).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("falls back to copying the canonical URL when the Web Share API is unavailable", async () => {
    const user = userEvent.setup();
    stubShare(undefined);
    const writeTextMock = stubClipboard();

    render(
      <ShareButton
        productId="p2"
        title="Vestido floral"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /compartir/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        `${window.location.origin}/products/p2`,
      );
    });
    expect(onCopied).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports an error when copying to the clipboard fails", async () => {
    const user = userEvent.setup();
    stubShare(undefined);
    stubClipboard(() => Promise.reject(new Error("denied")));

    render(
      <ShareButton
        productId="p3"
        title="Falda"
        onCopied={onCopied}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: /compartir/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("No pudimos copiar el enlace");
    });
    expect(onCopied).not.toHaveBeenCalled();
  });

  // Regression: sharing off the current address bar would leak a
  // `?preview=1` admin/seller preview query param into the shared link.
  it("ignores the current URL's query string, sharing the canonical product path", async () => {
    const user = userEvent.setup();
    stubShare(undefined);
    const writeTextMock = stubClipboard();
    const originalHref = window.location.href;
    window.history.pushState({}, "", "/products/p4?preview=1");

    try {
      render(
        <ShareButton
          productId="p4"
          title="Abrigo"
          onCopied={onCopied}
          onError={onError}
        />,
      );

      await user.click(screen.getByRole("button", { name: /compartir/i }));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(
          `${window.location.origin}/products/p4`,
        );
      });
    } finally {
      window.history.pushState({}, "", originalHref);
    }
  });
});
