import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Privacidad — Versale" };

export default function PrivacidadPage() {
  return (
    <StaticPage
      title="Política de privacidad"
      intro="Estamos redactando la política de privacidad de Versale antes del lanzamiento. Esta página se actualizará con el texto completo próximamente."
    />
  );
}
