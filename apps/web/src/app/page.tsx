import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="text-center py-16">
        <h1 className="text-4xl font-semibold tracking-tight">
          Buy and sell pre-owned clothing
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          A sustainable marketplace for second-hand fashion. Find unique pieces
          or give your wardrobe a second life.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/products"
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-5 py-2.5 hover:opacity-90"
          >
            Browse products
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Start selling
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Latest listings</h2>
        <ProductsBrowser />
      </section>
    </div>
  );
}
