import { describe, it, expect } from "vitest";
import { formatPublishDate } from "../format-date";

describe("formatPublishDate", () => {
  it("formatea en es-CO UTC determinista", () => {
    // 10 de enero de 2026 en UTC debe ser idéntico en servidor (UTC) y cliente (cualquier zona)
    expect(formatPublishDate("2026-01-10T10:00:00Z")).toBe(
      "Publicado el 10 de enero de 2026",
    );
  });

  it("es idempotente para el mismo timestamp", () => {
    const a = formatPublishDate("2026-12-31T23:00:00Z");
    const b = formatPublishDate("2026-12-31T23:00:00Z");
    expect(a).toBe(b);
  });

  it("no depende de la zona local (UTC explícito)", () => {
    // 2026-01-01 02:00 UTC es aún 31 de diciembre en America/Bogota (UTC-5) si se usara zona local,
    // pero con timeZone:"UTC" debe seguir siendo 1 de enero.
    expect(formatPublishDate("2026-01-01T02:00:00Z")).toBe(
      "Publicado el 1 de enero de 2026",
    );
  });

  it("retorna fallback para fecha inválida", () => {
    expect(formatPublishDate("not-a-date")).toBe("Fecha no disponible");
    expect(formatPublishDate("")).toBe("Fecha no disponible");
    expect(formatPublishDate("2026-13-01")).toBe("Fecha no disponible");
  });

  it("maneja string con espacios alrededor", () => {
    expect(formatPublishDate(" 2026-01-10T10:00:00Z ")).toBe(
      "Publicado el 10 de enero de 2026",
    );
  });
});
