import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex items-center gap-2 text-text-primary">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-xs font-bold"
          >
            V
          </span>
          <span className="text-sm font-semibold">Versale</span>
          <span className="hidden text-xs text-text-muted sm:inline">
            · Marketplace de moda de segunda
          </span>
        </div>
        <nav
          aria-label="Pie de página"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted"
        >
          <Link
            href="/products"
            className="transition-colors hover:text-text-primary"
          >
            Explorar
          </Link>
          <Link
            href="/sell"
            className="transition-colors hover:text-text-primary"
          >
            Vender
          </Link>
          <Link
            href="/login"
            className="transition-colors hover:text-text-primary"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="transition-colors hover:text-text-primary"
          >
            Crear cuenta
          </Link>
        </nav>
        <p className="w-full text-center text-xs text-text-muted sm:w-auto sm:text-right">
          © {new Date().getFullYear()} Versale. Reusa, ama, repite.
        </p>
      </div>
    </footer>
  );
}
