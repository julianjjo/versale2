import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reportes" };

export default function AdminReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
