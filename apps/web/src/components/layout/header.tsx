"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";
import { HeartIcon } from "@/components/products/favorite-button";

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

        {/* The inline nav runs from `md` so the supported tablet viewport keeps
            it, but the widest authenticated cluster (4 links + Admin badge +
            name chip + Cerrar sesión) used to need ~833px and pushed 768px into
            horizontal scroll. Between md and lg it runs condensed: tighter gaps
            and an initial-only profile link, so every destination stays
            reachable without overflowing. */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-5 md:flex lg:gap-9"
        >
          <NavLink href="/products">Explorar</NavLink>
          {user && <NavLink href="/cart">Carrito</NavLink>}
          {user && <NavLink href="/orders">Pedidos</NavLink>}
          {user && <NavLink href="/sell">Vender</NavLink>}
          {/* Same fix as the profile chip below: icon-only between md and lg
              (the tablet band already tuned to its widest cluster — a 5th
              full-text link there reintroduces the horizontal-scroll
              regression this file's history fixed), full label from lg up.
              A prior version hid this link entirely below lg while the
              mobile-menu trigger also hides at md, leaving md–lg with no
              path to the page at all — the icon closes that gap instead of
              opening one. */}
          {user && (
            <NavLink href="/mis-productos" ariaLabel="Mis publicaciones">
              <span aria-hidden="true" className="lg:hidden">
                <TagIcon />
              </span>
              <span aria-hidden="true" className="hidden lg:inline">
                Mis publicaciones
              </span>
            </NavLink>
          )}
          {/* Icon-only at every desktop width: the tablet band (md–lg) is
              already tuned to its widest cluster (see the comment on the
              outer <nav>), so a new item here can't afford the same
              icon-then-text toggle "Mis publicaciones" gets without
              reintroducing the overflow that pattern was built to avoid. */}
          {user && (
            <NavLink href="/favoritos" ariaLabel="Favoritos">
              <span aria-hidden="true">
                <HeartIcon />
              </span>
            </NavLink>
          )}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-full border border-terracotta/40 bg-terracotta/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-terracotta-deep transition-colors hover:bg-terracotta/20"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* No Buscar icon button: it wouldn't do anything. Search lives in
            the catalog filters behind "Explorar". Favoritos has its own nav
            icon above instead of living here. */}
        <div className="hidden items-center gap-2 md:flex">
          {!isLoading &&
            (user ? (
              <>
                {/* Below lg the full name is what tips the row into overflow,
                    so tablet gets an initial-only chip. It keeps its accessible
                    name either way, so /profile is still reachable and still
                    announced as the user's profile. */}
                <Link
                  href="/profile"
                  aria-label={`Perfil de ${user.name}`}
                  title={user.name}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted lg:px-4"
                >
                  <span aria-hidden="true" className="lg:hidden">
                    {user.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span aria-hidden="true" className="hidden lg:inline">
                    {user.name}
                  </span>
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

        <div className="flex items-center gap-1 md:hidden">
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
            className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm md:hidden"
          />
          <div
            ref={menuPanelRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación móvil"
            className="fixed inset-x-0 top-16 z-40 border-b border-border bg-surface shadow-lg md:hidden"
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
                <MobileLink href="/mis-productos" onClick={closeMenu}>
                  Mis publicaciones
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/favoritos" onClick={closeMenu}>
                  Favoritos
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

function NavLink({
  href,
  children,
  className = "",
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`group relative px-1 py-1 text-sm font-medium text-text-primary transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${className}`}
    >
      {children}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-text-primary transition-transform duration-300 group-hover:scale-x-100"
      />
    </Link>
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

function TagIcon() {
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
      <path d="M20.59 13.41 13 21l-9-9V4h8l9 9a2 2 0 0 1 0 3.41z" />
      <circle cx="7.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
