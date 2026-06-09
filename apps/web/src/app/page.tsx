import Link from "next/link";
import { ProductsBrowser } from "@/components/products/products-browser";
import { NewsletterCTA } from "@/components/marketing/newsletter-cta";

const CATEGORIES: { title: string; count: string; span: string }[] = [
  { title: "Vintage 90s", count: "1.2k piezas", span: "lg:col-span-5" },
  { title: "Denim", count: "860 piezas", span: "lg:col-span-4" },
  { title: "Básicos", count: "2k+", span: "lg:col-span-3" },
  { title: "Accesorios", count: "540 piezas", span: "lg:col-span-3" },
  { title: "Outerwear", count: "320 piezas", span: "lg:col-span-5" },
  { title: "Zapatos", count: "680 piezas", span: "lg:col-span-4" },
];

const STEPS = [
  {
    n: "01",
    title: "Publica tus prendas",
    body: "Sube fotos, describe el estado y ponle precio. Sin mínimo, sin compromiso.",
    tag: "→ Gratis y sin mínimo",
    tone: "paper-2" as const,
  },
  {
    n: "02",
    title: "Nuestro equipo las cura",
    body: "Revisamos cada pieza una a una, limpiamos, fotografiamos y publicamos con tu nombre.",
    tag: "→ Cobras hasta 70% del precio",
    tone: "paper-3" as const,
  },
  {
    n: "03",
    title: "Recibe tu dinero",
    body: "Cuando tu pieza se vende, el saldo entra a tu cuenta versale. Úsalo o retíralo.",
    tag: "→ Pago semanal disponible",
    tone: "ink" as const,
  },
];

const TESTIMONIALS = [
  {
    stars: "★★★★★",
    quote:
      "Vendí en una semana 4 chaquetas que tenía muertas en el armario. Y me pagaron lo justo. Volveré a subir todo lo que no uso.",
    name: "Lucía M.",
    loc: "Bogotá · vendedora",
    avatar: "https://i.pravatar.cc/100?img=47",
  },
  {
    stars: "★★★★★",
    quote:
      "Encontré una chaqueta de los 90 que llevaba meses buscando. Estaba nueva, llegó en 3 días y me ahorré 80€ vs. vintage online.",
    name: "Andrea P.",
    loc: "CDMX · compradora",
    avatar: "https://i.pravatar.cc/100?img=12",
  },
  {
    stars: "★★★★★",
    quote:
      "El filtro por estado de prenda y la descripción detallada me dan mucha confianza. Ya he hecho 6 pedidos y todos perfectos.",
    name: "Marta R.",
    loc: "Medellín · compradora",
    avatar: "https://i.pravatar.cc/100?img=32",
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
              Seis formas de empezar tu próximo look. Cada categoría, curada
              por nuestro equipo de estilistas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-12">
            {CATEGORIES.map((c, i) => (
              <Link
                key={c.title}
                href="/products"
                className={`group relative aspect-[1/1.2] overflow-hidden rounded-[18px] ${c.span}`}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-paper-3 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-x-6 bottom-6 z-10 text-paper">
                  <h3 className="font-display text-[28px] tracking-[-0.02em] sm:text-[30px]">
                    {c.title}
                  </h3>
                  <span className="text-[13px] opacity-85">{c.count}</span>
                </div>
                <span className="sr-only">{`Categoría ${c.title} con ${c.count}`}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ProductsSection />

      <StorySection />

      <HowSection />

      <EditorialSection />

      <TestimonialsSection />

      <NewsletterCTA />
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
          <dl className="mt-16 grid grid-cols-3 gap-8 border-t border-line pt-6">
            <Stat number="12k+" label="prendas revendidas" />
            <Stat number="4.2t" label="de CO₂ ahorrado" />
            <Stat number="3.4k" label="vendedores activos" />
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
            <span className="relative h-2 w-2 rounded-full bg-success">
              <span
                aria-hidden
                className="absolute -inset-1 rounded-full border border-success"
                style={{ animation: "ping 2s ease-out infinite" }}
              />
            </span>
            2.4k personas mirando ahora
          </div>

          <div className="absolute bottom-6 right-6 z-20 max-w-[240px] rounded-[14px] bg-ink px-5 py-4 text-paper">
            <b className="block font-display text-[22px]">−65%</b>
            <span className="mt-1 block text-[12px] leading-snug opacity-70">
              vs. precio original. Misma calidad, otro precio.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-[28px] font-medium leading-none tracking-[-0.02em] text-ink lg:text-[30px]">
        {number}
      </dt>
      <dd className="mt-1.5 text-[13px] text-muted-2">{label}</dd>
    </div>
  );
}

function Marquee() {
  const items = [
    "moda circular",
    "vintage curado",
    "envío neutro en carbono",
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
              Las favoritas de la semana.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill active>Todo</FilterPill>
            <FilterPill>Mujer</FilterPill>
            <FilterPill>Hombre</FilterPill>
            <FilterPill>Unisex</FilterPill>
            <FilterPill>−50%</FilterPill>
          </div>
        </div>

        <ProductsBrowser limit={6} showFilters={false} showPagination={false} />
      </div>
    </section>
  );
}

function FilterPill({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`filter-pill ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
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
            tiene la prenda que estabas buscando. Hoy somos una comunidad de
            miles de personas que deciden dar segunda vida a su ropa — y de
            paso, ahorramos agua, CO₂ y mucho fast fashion.
          </p>
          <p className="mt-4 max-w-[480px] text-base leading-[1.7] text-paper/75">
            Cada compra es un acto pequeño con un impacto real. Bienvenida a
            la moda circular.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-8 border-t border-line-4 pt-8">
            <div>
              <div className="font-display text-[64px] leading-none tracking-[-0.03em] text-terracotta">
                2.7M L
              </div>
              <div className="mt-2 max-w-[140px] text-[13px] text-paper/65">
                de agua ahorrados por cada 100 piezas
              </div>
            </div>
            <div>
              <div className="font-display text-[64px] leading-none tracking-[-0.03em] text-terracotta">
                85%
              </div>
              <div className="mt-2 max-w-[140px] text-[13px] text-paper/65">
                menos CO₂ que comprar nueva
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-[480px] overflow-hidden rounded-[20px] lg:h-[640px]">
          <div className="h-full w-full bg-paper-3" />
          <div className="absolute inset-x-6 bottom-6 flex items-center gap-4 rounded-[14px] bg-paper/95 p-5 text-ink">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-terracotta text-[20px] text-paper">
              ♻
            </div>
            <div>
              <b className="block font-display text-[18px]">
                Envío neutro en carbono
              </b>
              <span className="text-[12px] leading-snug text-muted-2">
                Compensamos el 100% de las emisiones de cada pedido.
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
            Nosotras nos encargamos de todo. Tú decides qué pasa con tu ropa,
            y recibes dinero por ello.
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
      <h3 className="mb-3 font-display text-[28px] tracking-[-0.02em]">
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
        className={`mt-5 inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-terracotta`}
      >
        {tag}
      </span>
    </div>
  );
}

function EditorialSection() {
  return (
    <section className="bg-surface py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-10 overflow-hidden rounded-[24px] bg-paper-2 p-8 sm:p-12 lg:grid-cols-2 lg:gap-16 lg:p-16">
          <div>
            <span className="text-eyebrow">Lookbook · Otoño '25</span>
            <h2 className="mt-4 mb-6 font-display text-[44px] leading-[1.05] tracking-[-0.03em] text-ink lg:text-[54px]">
              7 looks con <em>menos de 7 piezas</em>.
            </h2>
            <p className="mb-8 max-w-[440px] text-[15px] leading-[1.65] text-muted-2">
              Probamos cómo armar una semana entera de outfits usando solo
              básicos versátiles y una chaqueta statement. Spoiler: menos es
              mucho más.
            </p>
            <Link href="/products" className="btn-pill btn-pill-primary">
              Ver el lookbook
              <span className="arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <div className="h-[380px] overflow-hidden rounded-[18px] lg:h-[520px]">
            <div className="h-full w-full bg-paper-3" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="bg-surface py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
          <h2 className="max-w-[680px] heading-section text-ink">
            Lo que dice <em>la comunidad</em>.
          </h2>
          <p className="max-w-[340px] text-sm text-muted-2">
            Más de 80.000 personas ya compran y venden en versale. Esto es lo
            que opinan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="flex min-h-[340px] flex-col justify-between rounded-[18px] bg-paper-2 p-8"
            >
              <div>
                <div className="mb-5 text-[14px] tracking-[2px] text-terracotta">
                  {t.stars}
                </div>
                <p className="font-display text-[22px] leading-[1.35] tracking-[-0.01em] text-ink">
                  “{t.quote}”
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full bg-terracotta">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-ink">
                    {t.name}
                  </div>
                  <div className="text-[12px] text-muted">{t.loc}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
