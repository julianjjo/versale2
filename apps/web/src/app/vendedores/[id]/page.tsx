import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  SellerProfileContent,
  type SellerProfile,
} from "@/components/products/seller-profile-content";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type SellerLookup =
  | { status: "ok"; profile: SellerProfile }
  | { status: "missing" }
  | { status: "unavailable" };

// GET /products/sellers/:id takes no requester (see getSellerProfile in
// products.service.ts) — its response never varies by who's asking, so an
// anonymous server-side probe is exactly as valid as the client's own
// authenticated refetch, unlike a product listing (which can show more to
// its own seller or an admin).
async function lookupSeller(id: string): Promise<SellerLookup> {
  try {
    const response = await fetch(
      `${API_URL}/products/sellers/${encodeURIComponent(id)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", profile: (await response.json()) as SellerProfile };
  } catch {
    return { status: "unavailable" };
  }
}

// Every seller profile used to inherit the root layout's generic
// title/description — crawlers indexed every one identically, and sharing a
// link never showed the seller's name in the preview.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await lookupSeller(id);

  if (result.status !== "ok") {
    return { title: "Vendedor — Versale" };
  }

  const { profile } = result;
  const title = `${profile.name} — Versale`;
  const description = `Perfil de ${profile.name} en Versale: ${profile.activeListings} ${
    profile.activeListings === 1 ? "publicación activa" : "publicaciones activas"
  }.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await lookupSeller(id);

  if (result.status === "missing") notFound();

  return (
    <SellerProfileContent
      initialProfile={result.status === "ok" ? result.profile : undefined}
    />
  );
}
