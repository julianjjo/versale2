import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";
import { PageContainer } from "@/components/ui";

export default function HomePage() {
  return (
    <PageContainer size="wide">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-secondary px-6 py-16 text-text-inverse sm:px-10 sm:py-20">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-2xl text-center sm:text-left">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            Sustainable · Local · Trusted
          </span>
          <h1 className="heading-hero mt-4 text-text-inverse">
            Give fashion a second life.
          </h1>
          <p className="mt-4 text-base text-text-inverse/80 sm:text-lg">
            Versale is a peer-to-peer marketplace for pre-owned clothing.
            Discover unique pieces, sell what you no longer wear, and keep
            textiles out of landfills.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <Link
              href="/products"
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-inverse focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              Browse marketplace
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-md border border-text-inverse/30 px-6 text-base font-medium text-text-inverse transition-colors hover:bg-text-inverse/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-inverse focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              Start selling
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="heading-section text-text-primary">
              Latest listings
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Fresh pieces from sellers in the community.
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-text-primary transition-colors hover:text-text-muted"
          >
            View all →
          </Link>
        </div>
        <ProductsBrowser limit={6} showFilters={false} />
      </section>
    </PageContainer>
  );
}
