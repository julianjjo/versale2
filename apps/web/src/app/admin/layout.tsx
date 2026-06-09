"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner, EmptyState, Button, PageContainer } from "@/components/ui";

const TABS = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/users", label: "Usuarios" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Las páginas de administración requieren una cuenta."
          action={
            <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
          }
        />
      </PageContainer>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Acceso denegado"
          description="No tienes permisos para acceder a esta página."
          action={
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <h1 className="heading-section text-text-primary">Panel de administración</h1>
      <p className="mt-1 text-sm text-text-muted">
        Gestiona productos, pedidos y usuarios.
      </p>
      <div className="mt-6 mb-6 border-b border-border">
        <nav
          className="-mb-px flex gap-1 overflow-x-auto"
          aria-label="Secciones de administración"
        >
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 items-center border-b-2 px-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-muted hover:border-border hover:text-text-primary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </PageContainer>
  );
}
