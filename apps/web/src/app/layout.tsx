import type { Metadata } from "next";
import { fraunces, inter } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SkipLink } from "@/components/layout/skip-link";

// Título de respaldo: solo se ve en la portada. Cada ruta pone el suyo con
// `export const metadata`, y las que tienen `page.tsx` marcado "use client"
// —donde Next no puede leer metadata— montan un `layout.tsx` mínimo que no
// envuelve nada y solo aporta el título. Al agregar una ruta nueva, dale
// título por una de esas dos vías: heredar este deja la pestaña, el historial
// y los marcadores diciendo "Versale" en todas partes.
export const metadata: Metadata = {
  title: "Versale — Marketplace de moda de segunda",
  description:
    "Compra y vende ropa de segunda en Versale. Marketplace sostenible y confiable de moda usada en Colombia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen flex flex-col bg-surface text-text-primary antialiased">
        <SkipLink />
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
