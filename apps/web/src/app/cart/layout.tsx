import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tu carrito — Versale" };

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
