import type { Metadata } from "next";

export const metadata: Metadata = { title: "Historial de pedidos — Versale" };

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
