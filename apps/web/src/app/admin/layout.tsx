"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Spinner, EmptyState, Button, PageContainer } from "@/components/ui";

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
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Please log in"
          description="Admin pages require an account."
          action={
            <Button onClick={() => router.push("/login")}>Log in</Button>
          }
        />
      </PageContainer>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Access denied"
          description="You don't have permission to access this page."
          action={
            <Button onClick={() => router.push("/")}>Go home</Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <h1 className="heading-section text-text-primary">Admin dashboard</h1>
      <p className="mt-1 text-sm text-text-muted">
        Manage products, orders, and users.
      </p>
      <div className="mt-6 mb-6 border-b border-border">
        <nav
          className="-mb-px flex gap-1 overflow-x-auto"
          aria-label="Admin sections"
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
