import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tu perfil — Versale" };

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
