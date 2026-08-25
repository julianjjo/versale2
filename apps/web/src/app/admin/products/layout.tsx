import type { Metadata } from "next";

export const metadata: Metadata = { title: "Productos" };

export default function AdminProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
