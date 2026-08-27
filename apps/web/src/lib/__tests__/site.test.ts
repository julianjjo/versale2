import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("site", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("defaults SITE_URL to localhost:3000 without trailing slash", async () => {
    const { SITE_URL } = await import("../site");
    expect(SITE_URL).toBe("http://localhost:3000");
  });

  it("defaults API_URL to localhost:3001", async () => {
    const { API_URL } = await import("../site");
    expect(API_URL).toBe("http://localhost:3001");
  });

  it("trims trailing slash from SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    const { SITE_URL } = await import("../site");
    expect(SITE_URL).toBe("https://example.com");
  });

  it("trims multiple trailing slashes from SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com///";
    const { SITE_URL } = await import("../site");
    expect(SITE_URL).toBe("https://example.com");
  });

  it("preserves SITE_URL without trailing slash", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://versale.example.com";
    const { SITE_URL } = await import("../site");
    expect(SITE_URL).toBe("https://versale.example.com");
  });

  it("uses NEXT_PUBLIC_API_URL when set", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    const { API_URL } = await import("../site");
    expect(API_URL).toBe("https://api.example.com");
  });

  it("SITE_URL and API_URL are strings", async () => {
    const mod = await import("../site");
    expect(typeof mod.SITE_URL).toBe("string");
    expect(typeof mod.API_URL).toBe("string");
    expect(mod.SITE_URL.length).toBeGreaterThan(0);
  });
});
