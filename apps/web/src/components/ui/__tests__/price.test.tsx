import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Price } from "../index";

describe("Price", () => {
  it("formatea COP es-CO sin decimales", () => {
    render(<Price value={45000} data-testid="price" />);
    const el = screen.getByTestId("price");
    expect(el.textContent).toContain("45.000");
    expect(el.textContent).toContain("$");
  });

  it("formatea 0 como $ 0", () => {
    render(<Price value={0} data-testid="price-zero" />);
    expect(screen.getByTestId("price-zero").textContent).toMatch(/\$.*0/);
  });
});
