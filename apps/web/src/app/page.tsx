import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { ClosingCTA } from "@/components/marketing/closing-cta";

// Verifiable properties of the product, not usage metrics: Versale has no
// production traffic yet, so the home page must not present placeholder
// numbers (sales, viewers, sellers) as real evidence.
const TRUST_POINTS = [
  {
    label: "Revisión previa",
    body: "Un administrador aprueba cada publicación antes de que aparezca en el catálogo.",
  },
  {
    label: "Precios en COP",
    body: "Pensado para Colombia: todo se muestra en pesos colombianos.",
  },
  {
    label: "Vender sin trámites",
    body: "No hay rol de vendedor: publicas desde tu propia cuenta.",
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

      <StorySection />

      <HowSection />

      <ClosingCTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-surface pb-16 pt-12 lg:pb-24 lg:pt-16">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-end gap-12 px-5 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div>
          <span className="text-eyebrow">
            Ropa de segunda mano · curada con cariño
          </span>
          <h1 className="mt-6 heading-hero text-ink">
            Dale una <em>segunda</em> vida
            <br />a tu <span className="strike">moda</span>.
          </h1>
          <p className="mt-8 max-w-[420px] text-base leading-[1.65] text-muted-2">
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
          <dl className="mt-16 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-3 sm:gap-8">
            {TRUST_POINTS.map((point) => (
              <div key={point.label}>
                <dt className="font-display text-[20px] font-medium leading-tight tracking-[-0.02em] text-ink lg:text-[22px]">
                  {point.label}
                </dt>
                <dd className="mt-1.5 text-[13px] leading-[1.5] text-muted-2">
                  {point.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative h-[480px] lg:h-[640px]">
          <div className="absolute left-0 top-0 hidden h-[78%] w-[48%] overflow-hidden rounded-[18px] shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] lg:block">
            <div className="h-full w-full bg-paper-3" />
          </div>
          <div className="absolute right-0 top-0 h-[60%] w-full overflow-hidden rounded-[18px] shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] sm:h-[78%] sm:w-[62%]">
            <div className="h-full w-full bg-paper-3" />
          </div>
          <div className="absolute bottom-0 left-0 hidden h-[55%] w-[48%] overflow-hidden rounded-[18px] shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] lg:block">
            <div className="h-full w-full bg-paper-2" />
          </div>

          <div className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink shadow-[0_6px_20px_-8px_rgba(26,26,26,0.2)]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
            Cada prenda, revisada
          </div>

          <div className="absolute bottom-6 right-6 z-20 max-w-[240px] rounded-[14px] bg-ink px-5 py-4 text-paper">
            <b className="block font-display text-[22px]">Segunda mano</b>
            <span className="mt-1 block text-[12px] leading-snug opacity-70">
              Prendas con historia, revisadas antes de publicarse.
            </span>
          </div>
        </div>
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
    <section id="shop" className="bg-surface py-20 lg:py-32">
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
          <h2 className="mt-4 font-display font-normal leading-[1.05] tracking-[-0.03em] text-paper text-[clamp(40px,5.5vw,80px)]">
            La moda no se <em>consume</em>.
            <br />
            Se <em>comparte</em>.
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
          <div className="mt-12 grid grid-cols-1 gap-8 border-t border-line-4 pt-8 sm:grid-cols-2">
            <div>
              <div className="font-display text-[28px] leading-tight tracking-[-0.02em] text-terracotta-light">
                Curaduría antes que volumen
              </div>
              <div className="mt-2 max-w-[260px] text-[13px] leading-[1.6] text-paper/85">
                Ninguna publicación entra al catálogo sin que un administrador
                la apruebe.
              </div>
            </div>
            <div>
              <div className="font-display text-[28px] leading-tight tracking-[-0.02em] text-terracotta-light">
                Vender es cuestión de minutos
              </div>
              <div className="mt-2 max-w-[260px] text-[13px] leading-[1.6] text-paper/85">
                Sin rol de vendedor ni solicitud previa: cualquier cuenta puede
                publicar una prenda.
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-[480px] overflow-hidden rounded-[20px] lg:h-[640px]">
          <div className="h-full w-full bg-paper-3" />
          <div className="absolute inset-x-6 bottom-6 flex items-center gap-4 rounded-[14px] bg-paper/95 p-5 text-ink">
            <div
              aria-hidden
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-deep text-[20px] text-paper"
            >
              ♻
            </div>
            <div>
              <b className="block font-display text-[18px]">
                Cada prenda, revisada
              </b>
              <span className="text-[12px] leading-snug text-muted-2">
                Un administrador aprueba o rechaza cada publicación antes de
                que llegue al catálogo.
              </span>
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
          <h2 className="max-w-[780px] heading-section text-ink">
            Vender en versale es
            <br />
            <em>muy fácil</em>.
          </h2>
          <p className="max-w-[340px] text-sm text-muted-2">
            Tú publicas, nosotros revisamos. Sin rol de vendedor, sin
            solicitud previa y sin esperar una invitación.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {STEPS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </div>
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
    <div className={`relative overflow-hidden rounded-[20px] p-10 ${bg}`}>
      <div
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
    </div>
  );
}
