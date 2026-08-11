import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Términos — Versale" };

export default function TerminosPage() {
  return (
    <StaticPage
      title="Términos y condiciones"
      intro="Estamos redactando los términos y condiciones de Versale antes del lanzamiento. Esta página se actualizará con el texto completo próximamente."
    />
  );
}
