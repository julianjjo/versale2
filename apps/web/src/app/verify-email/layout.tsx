import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verifica tu correo — Versale" };

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
