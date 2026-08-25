import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis publicaciones — Versale" };

export default function MisProductosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
