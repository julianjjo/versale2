import Link from "next/link";

// Replaces the former newsletter block. There is no newsletter backend, so the
// old form discarded the address and claimed a subscription that never
// happened (plus a 15% discount that exists nowhere in the product). This
// section now closes the page with the two things the product can actually
// deliver today: the catalog and the publishing flow.
export function ClosingCTA() {
  return (
    <section className="relative overflow-hidden bg-terracotta-deep py-24 text-center text-paper lg:py-28">
      <div
        aria-hidden
        className="absolute -left-36 -top-48 h-[500px] w-[500px] rounded-full bg-paper/[0.06]"
      />
      <div
        aria-hidden
        className="absolute -bottom-72 -right-48 h-[700px] w-[700px] rounded-full bg-paper/[0.06]"
      />
      <div className="relative z-10 mx-auto max-w-[680px] px-5 sm:px-8">
        <span className="text-eyebrow text-eyebrow-paper">Moda circular</span>
        <h2 className="heading-on-accent mt-3 mb-5 font-display font-normal leading-[1.05] tracking-[-0.03em] text-paper text-[clamp(40px,5vw,68px)]">
          Dale una <em>segunda</em> vida
          <br />a lo que ya no usas.
        </h2>
        <p className="mx-auto mb-9 max-w-[520px] text-base leading-[1.6] text-paper">
          Cada publicación pasa por revisión antes de aparecer en el catálogo.
          Explora lo que ya está aprobado o sube tu primera prenda desde tu
          cuenta.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/products" className="btn-pill btn-pill-paper">
            Explorar el catálogo
            <span className="arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href="/sell" className="btn-pill btn-pill-ghost-paper">
            Publicar una prenda
          </Link>
        </div>
      </div>
    </section>
  );
}
