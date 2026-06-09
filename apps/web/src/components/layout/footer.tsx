import Link from "next/link";

const BUY_LINKS = [
  { label: "Explorar", href: "/products" },
  { label: "Mujer", href: "/products" },
  { label: "Hombre", href: "/products" },
  { label: "Unisex", href: "/products" },
  { label: "Drops nuevos", href: "/products" },
];

const SELL_LINKS = [
  { label: "Vender", href: "/sell" },
  { label: "Cómo funciona", href: "/sell" },
  { label: "Pedir bolsa", href: "/sell" },
  { label: "Calculadora de ganancias", href: "/sell" },
  { label: "Centro de ayuda", href: "/login" },
];

const COMPANY_LINKS = [
  { label: "Iniciar sesión", href: "/login" },
  { label: "Crear cuenta", href: "/signup" },
  { label: "Nuestra historia", href: "/products" },
  { label: "Impacto", href: "/products" },
  { label: "Contacto", href: "/login" },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-ink text-paper">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-20 sm:px-8">
        <div className="footer-grid mb-16 grid grid-cols-1 gap-12 md:grid-cols-2 xl:grid-cols-4 xl:gap-12">
          <div className="lg:col-span-1">
            <div className="mb-4 font-display text-[36px] font-medium tracking-[-0.03em]">
              versal<em className="text-terracotta">e</em>
            </div>
            <p className="mb-6 max-w-[280px] text-sm leading-relaxed opacity-65">
              Moda circular curada por personas, para personas. Hecho con cariño
              en Colombia, México y Argentina.
            </p>
            <div className="flex gap-2.5">
              <SocialLink label="Instagram">
                <InstagramIcon />
              </SocialLink>
              <SocialLink label="TikTok">
                <TikTokIcon />
              </SocialLink>
              <SocialLink label="Pinterest">
                <PinterestIcon />
              </SocialLink>
              <SocialLink label="Email">
                <MailIcon />
              </SocialLink>
            </div>
          </div>

          <FooterColumn title="Comprar" links={BUY_LINKS} />
          <FooterColumn title="Vender" links={SELL_LINKS} />
          <FooterColumn title="Versale" links={COMPANY_LINKS} />
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-line-3 pt-8 text-xs opacity-60 sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} Versale · Moda circular con ❤️</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/login" className="transition-opacity hover:opacity-100">
              Privacidad
            </Link>
            <Link href="/login" className="transition-opacity hover:opacity-100">
              Cookies
            </Link>
            <Link href="/login" className="transition-opacity hover:opacity-100">
              Términos
            </Link>
            <Link href="/login" className="transition-opacity hover:opacity-100">
              Envíos
            </Link>
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
              className="text-sm text-paper/85 transition-colors hover:text-terracotta"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialLink({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 text-paper transition-colors hover:border-terracotta hover:bg-terracotta"
    >
      {children}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="18" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 6.5a5.5 5.5 0 0 1-3.5-1.3V16a5 5 0 1 1-5-5v3a2 2 0 1 0 2 2V2h3a5 5 0 0 0 3.5 4.5z" />
    </svg>
  );
}

function PinterestIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.5s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.5-4.4-3.1 0-4.9 2.3-4.9 4.7 0 .9.4 1.9.8 2.5.1.1.1.2.1.3l-.3 1.2c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.8-2.4-4.5 0-3.7 2.7-7.1 7.7-7.1 4.1 0 7.2 2.9 7.2 6.8 0 4-2.6 7.3-6.1 7.3-1.2 0-2.3-.6-2.7-1.4l-.7 2.8c-.3 1-1 2.3-1.5 3.1A10 10 0 1 0 12 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  );
}
