import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/layout/static-page";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
function contactMailto(s: string): string | null {
  if (!CONTACT_EMAIL) return null;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(s)}`;
}
export const metadata: Metadata = { title: "Contacto — Versale" };
export default function ContactoPage() {
  const mailto = contactMailto("Consulta desde versale.co");
  return (
    <StaticPage
      title="Contacto"
      intro="Estamos construyendo un canal de contacto directo. Mientras tanto, la mayoría de dudas sobre compras, ventas y pedidos ya están respondidas en el Centro de ayuda."
    >
      <div className="space-y-3">
        <Link
          href="/ayuda"
          className="block font-medium text-terracotta-deep underline-offset-4 hover:underline"
        >
          Ir al Centro de ayuda
        </Link>
        {CONTACT_EMAIL && mailto ? (
          <a
            href={mailto}
            className="block font-medium text-terracotta-deep underline-offset-4 hover:underline"
          >
            Escríbenos a {CONTACT_EMAIL}
          </a>
        ) : (
          <p className="text-sm text-text-muted">Canal por correo electrónico: próximamente.</p>
        )}
      </div>
    </StaticPage>
  );
}
