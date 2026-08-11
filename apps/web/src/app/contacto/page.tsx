import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Contacto — Versale" };

export default function ContactoPage() {
  return (
    <StaticPage
      title="Contacto"
      intro="Estamos construyendo un canal de contacto directo. Mientras tanto, la mayoría de dudas sobre compras, ventas y pedidos ya están respondidas en el Centro de ayuda."
    >
      <Link
        href="/ayuda"
        className="font-medium text-terracotta underline-offset-4 hover:underline"
      >
        Ir al Centro de ayuda
      </Link>
    </StaticPage>
  );
}
