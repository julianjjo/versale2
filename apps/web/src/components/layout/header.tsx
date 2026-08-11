"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

export function Header() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setIsMenuOpen(false);
    menuTriggerRef.current?.focus();
  };
  const handleLogout = () => {
    closeMenu();
    logout();
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // Move focus into the panel on open and trap Tab within it, so a
  // keyboard user can't Tab past the open dialog into the obscured page.
  useEffect(() => {
    if (!isMenuOpen) return;
    const panel = menuPanelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusable[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center justify-between gap-2 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-baseline text-text-primary"
          aria-label="Inicio de Versale"
        >
          <span
            className="font-display text-[28px] font-medium tracking-[-0.03em]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Versale
          </span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-9 sm:flex"
        >
          <NavLink href="/products">Explorar</NavLink>
          {user && <NavLink href="/cart">Carrito</NavLink>}
          {user && <NavLink href="/orders">Pedidos</NavLink>}
          {user && <NavLink href="/sell">Vender</NavLink>}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-full border border-terracotta/40 bg-terracotta/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-terracotta-deep transition-colors hover:bg-terracotta/20"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <IconButton ariaLabel="Buscar">
            <SearchIcon />
          </IconButton>
          <IconButton ariaLabel="Favoritos">
            <HeartIcon />
          </IconButton>

          {!isLoading &&
            (user ? (
              <>
                <Link
                  href="/profile"
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
                >
                  {user.name}
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLogout}
                  pill
                >
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <div className="ml-1 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/login")}
                  pill
                >
                  Iniciar sesión
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => router.push("/signup")}
                  pill
                >
                  Crear cuenta
                </Button>
              </div>
            ))}
        </div>

        <div className="flex items-center gap-1 sm:hidden">
          {user && (
            <Link
              href="/cart"
              aria-label="Carrito"
              className="rounded-full p-3 text-text-primary transition-colors hover:bg-surface-muted"
            >
              <CartIcon />
            </Link>
          )}
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            data-testid="mobile-menu-trigger"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:bg-surface-muted"
          >
            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            data-testid="mobile-menu-backdrop"
            onClick={closeMenu}
            className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm sm:hidden"
          />
          <div
            ref={menuPanelRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación móvil"
            className="fixed inset-x-0 top-16 z-40 border-b border-border bg-surface shadow-lg sm:hidden"
          >
            <nav
              aria-label="Navegación móvil"
              className="mx-auto flex max-w-[1320px] flex-col gap-1 px-4 py-4"
            >
              <MobileLink href="/products" onClick={closeMenu}>
                Explorar
              </MobileLink>
              {user && (
                <MobileLink href="/cart" onClick={closeMenu}>
                  Carrito
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/orders" onClick={closeMenu}>
                  Pedidos
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/sell" onClick={closeMenu}>
                  Vender
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/profile" onClick={closeMenu}>
                  Mi perfil ({user.name})
                </MobileLink>
              )}
              {user?.role === "ADMIN" && (
                <MobileLink href="/admin" onClick={closeMenu}>
                  Admin
                </MobileLink>
              )}

              <div className="my-2 border-t border-border" />

              {!isLoading &&
                (user ? (
                  <Button
                    variant="secondary"
                    onClick={handleLogout}
                    fullWidth
                    pill
                  >
                    Cerrar sesión
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        closeMenu();
                        router.push("/login");
                      }}
                      fullWidth
                      pill
                    >
                      Iniciar sesión
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        closeMenu();
                        router.push("/signup");
                      }}
                      fullWidth
                      pill
                    >
                      Crear cuenta
                    </Button>
                  </div>
                ))}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative px-1 py-1 text-sm font-medium text-text-primary transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {children}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-text-primary transition-transform duration-300 group-hover:scale-x-100"
      />
    </Link>
  );
}

function IconButton({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {children}
    </button>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-md px-3 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {children}
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 14c1.5-1.4 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4.1 3 5.5l7 7Z" />
    </svg>
  );
}
