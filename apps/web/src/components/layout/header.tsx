"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/token";

export function Header() {
  const router = useRouter();

  const handleLogout = () => {
    tokenStore.clear();
    router.push("/");
    router.refresh();
  };

  const hasToken = typeof window !== "undefined" && tokenStore.get() !== null;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Versale
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/products" className="hover:underline">
            Browse
          </Link>
          <Link href="/cart" className="hover:underline">
            Cart
          </Link>
          <Link href="/orders" className="hover:underline">
            Orders
          </Link>
          {hasToken ? (
            <>
              <Link href="/profile" className="hover:underline">
                Profile
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
          )}
        </nav>
      </div>
    </header>
  );
}
