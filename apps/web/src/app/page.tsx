import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";
import { RecentlyViewedSection } from "@/components/products/recently-viewed";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { ClosingCTA } from "@/components/marketing/closing-cta";

// Verifiable properties of the product, not usage metrics: Versale has no
// production traffic yet, so the home page must not present placeholder
// numbers (sales, viewers, sellers) as real evidence.
//
// Hung from the hero's rail. The stem lengths are deliberately unequal — see
// the `.drop` block in globals.css for why the whole home page trades picture
// frames for suspension.
const TRUST_POINTS = [
  {
    label: "Revisión previa",
    body: "Un administrador aprueba cada publicación antes de que aparezca en el catálogo.",
    stem: "[--stem:24px]",
  },
  {
    label: "Precios en COP",
    body: "Pensado para Colombia: todo se muestra en pesos colombianos.",
    stem: "[--stem:56px]",
  },
  {
    label: "Vender sin trámites",
    body: "No hay rol de vendedor: publicas desde tu propia cuenta.",
    stem: "[--stem:36px]",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Publica tus prendas",
    body: "Sube fotos, describe el estado y ponle precio en pesos colombianos. No necesitas una cuenta de vendedor aparte.",
    tag: "→ Desde tu cuenta, sin solicitud",
    tone: "paper-2" as const,
  },
  {
    n: "02",
    title: "Un administrador la revisa",
    // No prometas el aviso de rechazo: hoy no existe ninguna superficie que le
    // muestre al vendedor que su publicación fue rechazada ni por qué.
    body: "Revisamos cada publicación antes de que entre al catálogo, para que todo lo que se ve sea de fiar.",
    tag: "→ Revisión antes de publicar",
    tone: "paper-3" as const,
  },
  {
    n: "03",
    title: "Vende y coordina la entrega",
    body: "Cuando alguien compra tu prenda, el pedido queda registrado y puedes seguir su estado hasta la entrega.",
    tag: "→ Seguimiento del estado del pedido",
    tone: "ink" as const,
  },
];

export default function HomePage() {
  return (
    <div>
      <Hero />
      <Marquee />

      <section className="bg-surface pb-20 pt-16 lg:pb-32 lg:pt-24">
        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
            <div>
              <span className="text-eyebrow">Explora</span>
              <h2 className="mt-3 max-w-[780px] heading-section text-ink">
                Encuentra tu próximo <em>favorito</em>.
              </h2>
            </div>
            <p className="max-w-[340px] text-sm text-muted-2">
              Las categorías que la comunidad ya está publicando. Cada una te
              lleva al catálogo filtrado por esa categoría.
            </p>
          </div>

          <CategoryGrid />
        </div>
      </section>

      <ProductsSection />

      <RecentlyViewedSection />

      <StorySection />

      <HowSection />

      <ClosingCTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-surface pb-16 pt-12 lg:pb-24 lg:pt-16">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <span className="text-eyebrow">
          Ropa de segunda mano · curada con cariño
        </span>
        {/* The second column is gone. It held three overlapping rounded
            rectangles standing in for photographs that are never coming —
            Versale's only images are garments shot by the people who own them
            — and losing it is what finally gives this headline the full
            clamp(56px, 9vw, 148px) the type scale always specified for it. */}
        <h1 className="mt-6 max-w-[980px] heading-hero heading-lines text-ink">
          <span>
            Dale una <em>segunda</em> vida
          </span>
          <span>
            a tu <span className="strike">moda</span>.
          </span>
        </h1>
        <p className="mt-8 max-w-[440px] text-base leading-[1.65] text-muted-2">
          Cada prenda en versale es revisada una a una. Moda circular,
          precios reales, estilo con historia. Viste diferente sin vestir
          al planeta.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3.5">
          <Link href="/products" className="btn-pill btn-pill-primary">
            Explorar marketplace
            <span className="arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href="/sell" className="btn-pill btn-pill-ghost">
            Empieza a vender
          </Link>
        </div>
        <dl className="mt-16 flex flex-col gap-10 sm:flex-row sm:gap-6 lg:mt-24 lg:gap-10">
          {TRUST_POINTS.map((point) => (
            <div key={point.label} className={`drop flex-1 ${point.stem}`}>
              <dt className="font-display text-[22px] font-medium leading-tight tracking-[-0.02em] text-ink lg:text-[26px]">
                {point.label}
              </dt>
              <dd className="mt-2 max-w-[340px] text-[14px] leading-[1.6] text-muted-2">
                {point.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [
    "moda circular",
    "vintage curado",
    "segunda mano",
    "segunda vida",
    "estilo real",
  ];
  const repeated = Array.from({ length: 4 }).flatMap(() => items);
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {repeated.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function ProductsSection() {
  return (
    <section id="shop" className="scroll-anchor bg-surface py-20 lg:py-32">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="text-eyebrow">Recién llegadas</span>
            <h2 className="mt-3 heading-section-sm text-ink">
              Lo último aprobado.
            </h2>
          </div>
          <Link href="/products" className="btn-pill btn-pill-ghost">
            Ver todo el catálogo
            <span className="arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>

        <ProductsBrowser limit={6} showFilters={false} showPagination={false} />
      </div>
    </section>
  );
}

function StorySection() {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-paper lg:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 text-[520px] leading-none text-terracotta/[0.08]"
      >
        ♻
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-[1320px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <div>
          <span className="text-eyebrow text-eyebrow-terracotta">
            Nuestra historia
          </span>
          <h2 className="heading-lines mt-4 font-display font-normal leading-[1.05] tracking-[-0.03em] text-paper text-[clamp(40px,5.5vw,80px)]">
            <span>
              La moda no se <em>consume</em>.
            </span>
            <span>
              Se <em>comparte</em>.
            </span>
          </h2>
          <p className="mt-8 max-w-[480px] text-base leading-[1.7] text-paper/75">
            Versale nació con una idea simple: el armario de alguien más ya
            tiene la prenda que estabas buscando. Estamos construyendo un
            marketplace donde dar segunda vida a la ropa sea tan fácil como
            comprarla nueva — y mucho menos costoso para el planeta.
          </p>
          <p className="mt-4 max-w-[480px] text-base leading-[1.7] text-paper/75">
            Cada compra es un acto pequeño con un impacto real. Bienvenida a
            la moda circular.
          </p>
        </div>

        {/* Was a 640px `bg-paper-3` rectangle with a trust pill floating at its
            bottom edge — an empty picture frame propping up a caption. The two
            claims that used to be crammed into a stat row under the body copy
            now hang here as the column's actual content, and the pill's
            approval mark rides on the claim it belongs to. */}
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-6 lg:gap-8">
          <div className="drop drop-ink flex-[1.15] [--stem:24px]">
            <div className="drop-form flex min-h-[300px] flex-col justify-between bg-paper-2 p-7 text-ink lg:min-h-[380px]">
              <div>
                <h3 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-ink lg:text-[30px]">
                  Curaduría antes que volumen
                </h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-muted-2">
                  Ninguna publicación entra al catálogo sin que un
                  administrador la apruebe o la rechace.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-deep text-paper"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="m4.5 12.5 5 5 10-11" />
                  </svg>
                </span>
                <b className="font-display text-[16px] font-medium text-ink">
                  Cada prenda, revisada
                </b>
              </div>
            </div>
          </div>

          <div className="drop drop-ink flex-[0.85] [--stem:68px]">
            <div className="drop-form flex min-h-[240px] flex-col bg-paper-2 p-7 text-ink lg:min-h-[280px]">
              <h3 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-ink lg:text-[30px]">
                Vender es cuestión de minutos
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-muted-2">
                Sin rol de vendedor ni solicitud previa: cualquier cuenta puede
                publicar una prenda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section className="bg-surface py-24 lg:py-32">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
          <h2 className="max-w-[780px] heading-section heading-lines text-ink">
            <span>Vender en versale es</span>
            <span>
              <em>muy fácil</em>.
            </span>
          </h2>
          <p className="max-w-[340px] text-sm text-muted-2">
            Tú publicas, nosotros revisamos. Sin rol de vendedor, sin
            solicitud previa y sin esperar una invitación.
          </p>
        </div>

        {/* An <ol>, not a <div>: the numerals are the visual form of a real
            sequence, and they're aria-hidden below, so the order has to live
            in the markup. role="list" restores the semantics Safari drops
            once the list-style is none. */}
        <ol role="list" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {STEPS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepCard({
  n,
  title,
  body,
  tag,
  tone,
}: {
  n: string;
  title: string;
  body: string;
  tag: string;
  tone: "paper-2" | "paper-3" | "ink";
}) {
  const ink = tone === "ink";
  const bg =
    tone === "paper-2"
      ? "bg-paper-2 text-ink"
      : tone === "paper-3"
        ? "bg-paper-3 text-ink"
        : "bg-ink text-paper";
  return (
    <li className={`relative overflow-hidden rounded-[20px] p-10 ${bg}`}>
      <div
        aria-hidden="true"
        className={`mb-6 font-display text-[80px] italic leading-none ${
          ink ? "text-paper/15" : "text-ink/10"
        }`}
      >
        {n}
      </div>
      {/* Headings carry --color-ink from the base layer, which is invisible on
          the ink-toned card — set the colour on the element itself. */}
      <h3
        className={`mb-3 font-display text-[28px] tracking-[-0.02em] ${
          ink ? "text-paper" : "text-ink"
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-[14px] leading-[1.6] ${
          ink ? "text-paper/70" : "text-muted-2"
        }`}
      >
        {body}
      </p>
      <span
        className={`mt-5 inline-block text-[11px] font-semibold uppercase tracking-[0.12em] ${
          tone === "ink"
            ? "text-terracotta-light"
            : tone === "paper-3"
              ? "text-ink"
              : "text-terracotta-deep"
        }`}
      >
        {tag}
      </span>
    </li>
  );
}
