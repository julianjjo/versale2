"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Header() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Versale
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/products" className="hover:underline">
            Browse
          </Link>
          {user && (
            <Link href="/cart" className="hover:underline">
              Cart
            </Link>
          )}
          {user && (
            <Link href="/orders" className="hover:underline">
              Orders
            </Link>
          )}
          {user && (
            <Link href="/sell" className="hover:underline">
              Sell
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 px-2.5 py-1 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50"
            >
              Admin
            </Link>
          )}

          {!isLoading &&
            (user ? (
              <>
                <Link
                  href="/profile"
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {user.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-3 py-1.5 hover:opacity-90"
                >
                  Sign up
                </Link>
              </>
            ))}
        </nav>
      </div>
    </header>
  );
}
