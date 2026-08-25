import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reseñas" };

export default function AdminReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
