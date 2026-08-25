import type { Metadata } from "next";

export const metadata: Metadata = { title: "Publicar un producto — Versale" };

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
