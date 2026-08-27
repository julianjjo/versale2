"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";
import { NotificationBell } from "./notification-bell";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
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
    setIsMenuOpen(false);
  }, [pathname]);

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
      <div className="mx-auto flex h-[var(--header-h)] w-full max-w-[1320px] items-center justify-between gap-2 px-5 sm:px-8">
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
            horizontal scroll. Rather than keep shrinking individual links to
            icon-only between md and lg (a per-feature patch that ran out of
            headroom), secondary destinations (Mis publicaciones, Favoritos,
            Mi perfil) live in the "Más" overflow menu below that width — see
            MoreMenu. At `lg` there's room for the full cluster, so the
            overflow menu hides and those destinations render inline/full-text
            instead. Add future secondary links to MoreMenu's `items`, not
            this row — that keeps this row's width fixed regardless of how
            many destinations get added later. */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-5 md:flex lg:gap-9"
        >
          <NavLink href="/products">Explorar</NavLink>
          {user && <NavLink href="/cart">Carrito</NavLink>}
          {user && <NavLink href="/orders">Pedidos</NavLink>}
          {user && <NavLink href="/sell">Vender</NavLink>}
          {/* Full text only at `lg`+; below that it lives in the "Más" menu. */}
          {user && (
            <NavLink href="/mis-productos" className="hidden lg:inline">
              Mis publicaciones
            </NavLink>
          )}
          {user && (
            <NavLink href="/mis-ventas" className="hidden lg:inline">
              Mis ventas
            </NavLink>
          )}
          {user && (
            <NavLink href="/favoritos" className="hidden lg:inline">
              Favoritos
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
          {user && (
            <MoreMenu
              items={[
                { href: "/mis-productos", label: "Mis publicaciones" },
                { href: "/mis-ventas", label: "Mis ventas" },
                { href: "/favoritos", label: "Favoritos" },
                { href: "/profile", label: `Mi perfil (${user.name})` },
              ]}
            />
          )}
        </nav>

        {/* No Buscar icon button: it wouldn't do anything. Search lives in
            the catalog filters behind "Explorar". */}
        <div className="hidden items-center gap-2 md:flex">
          {!isLoading &&
            (user ? (
              <>
                <NotificationBell />
                {/* Full name only at `lg`+, where the row has room; below
                    that, "Mi perfil" lives in the "Más" menu instead (see
                    MoreMenu in the nav above). */}
                <Link
                  href="/profile"
                  aria-label={`Perfil de ${user.name}`}
                  title={user.name}
                  className="hidden rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted lg:inline-block"
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

        <div className="flex items-center gap-1 md:hidden">
          {user && <NotificationBell />}
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
            className="fixed inset-x-0 top-[var(--header-h)] z-40 border-b border-border bg-surface shadow-lg md:hidden"
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
                <MobileLink href="/mis-ventas" onClick={closeMenu}>
                  Mis ventas
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

function MoreMenu({
  items,
}: {
  items: { href: string; label: React.ReactNode }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="header-more-menu"
        className="flex items-center gap-1 px-1 py-1 text-sm font-medium text-text-primary transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Más
        <ChevronDownIcon
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div
          id="header-more-menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
