import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pedidos" };

export default function AdminOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
