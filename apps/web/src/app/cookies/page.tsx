import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Cookies — Versale" };

export default function CookiesPage() {
  return (
    <StaticPage
      title="Política de cookies"
      intro="Estamos redactando la política de cookies de Versale antes del lanzamiento. Esta página se actualizará con el texto completo próximamente."
    />
  );
}
