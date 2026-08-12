"use client";

import { useEffect } from "react";

// Este boundary reemplaza al layout raíz cuando el propio layout falla, así que
// no puede depender de los providers ni de las clases de Tailwind: va con
// estilos en línea y los colores de la paleta escritos a mano (globals.css).
const PAPER = "#f6f3ee";
const INK = "#1a1a1a";
const MUTED = "#5a5045";
const TERRACOTTA_DEEP = "#a04d2c";
const LINE = "rgba(26, 26, 26, 0.1)";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Solo a consola: el mensaje crudo no se le muestra a la persona.
    console.error(error);
  }, [error]);

  return (
    <html lang="es-CO">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: PAPER,
          color: INK,
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "480px",
            textAlign: "center",
            border: `1px dashed ${LINE}`,
            borderRadius: "16px",
            padding: "48px 24px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Versale
          </p>
          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "32px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: MUTED,
            }}
          >
            Tuvimos un problema al cargar Versale. Intenta de nuevo en unos
            segundos o vuelve al inicio.
          </p>
          <div
            style={{
              marginTop: "28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: "48px",
                padding: "0 24px",
                borderRadius: "6px",
                border: "1px solid transparent",
                background: TERRACOTTA_DEEP,
                color: PAPER,
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            {/* Ancla y no <Link>: si el layout raíz falló, la navegación del
                lado del cliente volvería al mismo árbol roto. Recargar el
                documento entero es la única salida confiable. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: INK,
                textUnderlineOffset: "4px",
              }}
            >
              Volver al inicio
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
