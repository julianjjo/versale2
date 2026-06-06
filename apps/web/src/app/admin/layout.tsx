"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner, EmptyState } from "@/components/ui";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
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
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Please log in"
          description="Admin pages require an account."
          action={
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Log in
            </Link>
          }
        />
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Access denied"
          description="You don't have permission to access this page."
          action={
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Go home
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Admin dashboard</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Manage products, orders, and users.
      </p>
      <div className="border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                  active
                    ? "border-zinc-900 dark:border-zinc-50 font-medium"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
