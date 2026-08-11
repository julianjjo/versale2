import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Envíos — Versale" };

export default function EnviosPage() {
  return (
    <StaticPage
      title="Envíos"
      intro="Estamos documentando nuestras políticas de envío y devoluciones. Vuelve pronto para conocer los detalles completos."
    />
  );
}
