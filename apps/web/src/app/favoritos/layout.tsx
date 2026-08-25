import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tus favoritos — Versale" };

export default function FavoritosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
