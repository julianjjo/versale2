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
  { href: "/admin/reviews", label: "Reseñas" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/preguntas", label: "Preguntas" },
];

function AdminBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <span className="font-display text-lg font-medium tracking-[-0.02em] text-text-primary">
        Versale
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Admin
      </span>
    </Link>
  );
}

function AdminChrome({
  children,
  containerSize = "default",
}: {
  children: React.ReactNode;
  containerSize?: "narrow" | "default" | "wide";
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <AdminBrand />
      </header>
      <PageContainer size={containerSize} className="flex-1">
        {children}
      </PageContainer>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
    router.refresh();
  };

  if (isLoading) {
    return (
      <AdminChrome>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </AdminChrome>
    );
  }

  if (!user) {
    return (
      <AdminChrome containerSize="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Las páginas de administración requieren una cuenta."
          action={
            <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
          }
        />
      </AdminChrome>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <AdminChrome containerSize="narrow">
        <EmptyState
          title="Acceso denegado"
          description="No tienes permisos para acceder a esta página."
          action={
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
          }
        />
      </AdminChrome>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <AdminBrand />
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm font-medium text-text-muted transition-colors hover:text-text-primary sm:inline"
            >
              Ver tienda
            </Link>
            <span className="hidden text-sm text-text-muted sm:inline">
              {user.name}
            </span>
            <Button size="sm" variant="secondary" pill onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
        <nav
          className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6"
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
                className={`inline-flex h-11 flex-shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors ${
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
      </header>

      <PageContainer size="wide" className="flex-1">
        {children}
      </PageContainer>
    </div>
  );
}
