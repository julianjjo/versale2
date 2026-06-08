"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

export function Header() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-text-primary"
          aria-label="Versale home"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-bold"
          >
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">Versale</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex sm:gap-2"
        >
          <Link
            href="/products"
            className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            Browse
          </Link>
          {user && (
            <Link
              href="/cart"
              className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              Cart
            </Link>
          )}
          {user && (
            <Link
              href="/orders"
              className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              Orders
            </Link>
          )}
          {user && (
            <Link
              href="/sell"
              className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              Sell
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/20"
            >
              Admin
            </Link>
          )}

          {!isLoading &&
            (user ? (
              <div className="ml-2 flex items-center gap-2">
                <Link
                  href="/profile"
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-muted"
                >
                  {user.name}
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="ml-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/login")}
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => router.push("/signup")}
                >
                  Sign up
                </Button>
              </div>
            ))}
        </nav>

        <div className="flex items-center gap-1 sm:hidden">
          {user && (
            <Link
              href="/cart"
              aria-label="Cart"
              className="rounded-md p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              <CartIcon />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            data-testid="mobile-menu-trigger"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-text-primary transition-colors hover:bg-surface-muted"
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
            className="fixed inset-0 z-30 bg-secondary/30 backdrop-blur-sm sm:hidden"
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-x-0 top-16 z-40 border-b border-border bg-surface shadow-lg sm:hidden"
          >
            <nav
              aria-label="Mobile"
              className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4"
            >
              <MobileLink href="/products" onClick={closeMenu}>
                Browse
              </MobileLink>
              {user && (
                <MobileLink href="/cart" onClick={closeMenu}>
                  Cart
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/orders" onClick={closeMenu}>
                  Orders
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/sell" onClick={closeMenu}>
                  Sell
                </MobileLink>
              )}
              {user && (
                <MobileLink href="/profile" onClick={closeMenu}>
                  Profile ({user.name})
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
                  >
                    Logout
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
                    >
                      Login
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        closeMenu();
                        router.push("/signup");
                      }}
                      fullWidth
                    >
                      Sign up
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
      className="rounded-md px-3 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface-muted"
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
