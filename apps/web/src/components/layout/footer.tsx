import Link from "next/link";

const BUY_LINKS = [
  { label: "Explorar", href: "/products" },
  { label: "Nuevo", href: "/products?condition=New" },
  { label: "Como nuevo", href: "/products?condition=Like%20New" },
  { label: "Buen estado", href: "/products?condition=Good" },
];

const ACCOUNT_LINKS = [
  { label: "Vender", href: "/sell" },
  { label: "Mis pedidos", href: "/orders" },
  { label: "Mi perfil", href: "/profile" },
  { label: "Iniciar sesión", href: "/login" },
  { label: "Crear cuenta", href: "/signup" },
];

const HELP_LINKS = [
  { label: "Centro de ayuda", href: "/ayuda" },
  { label: "Contacto", href: "/contacto" },
  { label: "Envíos", href: "/envios" },
];

const LEGAL_LINKS = [
  { label: "Privacidad", href: "/privacidad" },
  { label: "Cookies", href: "/cookies" },
  { label: "Términos", href: "/terminos" },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-ink text-paper">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-20 sm:px-8">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="mb-4 font-display text-[36px] font-medium tracking-[-0.03em]">
              versal<em className="text-terracotta">e</em>
            </div>
            <p className="max-w-[280px] text-sm leading-relaxed text-paper/70">
              Moda circular curada por personas, para personas. Hecho con
              cariño en Colombia.
            </p>
          </div>

          <FooterColumn title="Comprar" links={BUY_LINKS} />
          <FooterColumn title="Tu cuenta" links={ACCOUNT_LINKS} />
          <FooterColumn title="Ayuda" links={HELP_LINKS} />
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-line-3 pt-8 text-xs sm:flex-row sm:items-center">
          <div className="text-paper/60">
            © {new Date().getFullYear()} Versale · Moda circular con ❤️
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-sm text-paper/60 transition-colors duration-200 ease-out hover:text-paper focus-visible:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="mb-5 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-paper/50">
        {title}
      </h4>
      <ul className="flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="rounded-sm text-sm text-paper/85 transition-colors duration-200 ease-out hover:text-terracotta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
