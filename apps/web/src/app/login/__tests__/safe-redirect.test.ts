import { describe, it, expect } from "vitest";
import { safeLoginRedirect, DEFAULT_LOGIN_REDIRECT } from "../safe-redirect";

describe("safeLoginRedirect", () => {
  it("acepta rutas internas", () => {
    expect(safeLoginRedirect("/products/p1")).toBe("/products/p1");
    expect(safeLoginRedirect("/cart?ref=email")).toBe("/cart?ref=email");
    expect(safeLoginRedirect("/orders#ultimo")).toBe("/orders#ultimo");
  });

  it("cae al catálogo cuando no hay destino", () => {
    expect(safeLoginRedirect(null)).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect(undefined)).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("")).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  it("rechaza URLs con protocolo relativo que salen del origen", () => {
    expect(safeLoginRedirect("//evil.example")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("//127.0.0.1:3101/products")).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(safeLoginRedirect("/\\evil.example")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("\\\\evil.example")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("/\t/evil.example")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("  //evil.example")).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  it("rechaza valores con esquema", () => {
    expect(safeLoginRedirect("https://evil.example")).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(safeLoginRedirect("javascript:alert(1)")).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(safeLoginRedirect("/javascript:alert(1)")).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
  });

  it("rechaza rutas relativas que no empiezan con /", () => {
    expect(safeLoginRedirect("products")).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(safeLoginRedirect("../admin")).toBe(DEFAULT_LOGIN_REDIRECT);
  });
});
