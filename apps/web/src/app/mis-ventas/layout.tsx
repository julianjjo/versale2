import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis ventas — Versale" };

export default function MisVentasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
