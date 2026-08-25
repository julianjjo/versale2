import type { Metadata } from "next";

export const metadata: Metadata = { title: "Detalle del pedido — Versale" };

export default function OrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
