import type { Metadata } from "next";
import { AdminShell } from "./admin-shell";

// El shell del panel (guardia de sesión, pestañas, cierre de sesión) es un
// componente de cliente y por eso no puede exportar `metadata`. Este layout de
// servidor existe únicamente para ponerle título al panel: cada `layout.tsx`
// hijo aporta el nombre de su sección y esta plantilla lo completa, de modo
// que una pestaña abierta en el panel se distingue de la tienda sin depender
// de que el usuario recuerde en qué sección estaba.
export const metadata: Metadata = {
  title: {
    default: "Panel de administración — Versale",
    template: "%s · Admin — Versale",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
