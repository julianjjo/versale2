import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="text-center py-12 sm:py-20">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
          Buy and sell pre-owned clothing
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          A sustainable marketplace for second-hand fashion. Find unique
          pieces or give your wardrobe a second life.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-5 py-2.5 hover:opacity-90"
          >
            Browse products
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Start selling
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Latest listings</h2>
          <Link
            href="/products"
            className="text-sm text-zinc-500 hover:underline"
          >
            View all →
          </Link>
        </div>
        <ProductsBrowser limit={6} />
      </section>
    </div>
  );
}
