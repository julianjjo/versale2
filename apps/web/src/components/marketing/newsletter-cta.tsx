import { NewsletterForm } from "./newsletter-form";

export function NewsletterCTA() {
  return (
    <section className="relative overflow-hidden bg-terracotta py-24 text-center text-paper lg:py-28">
      <div
        aria-hidden
        className="absolute -left-36 -top-48 h-[500px] w-[500px] rounded-full bg-paper/[0.06]"
      />
      <div
        aria-hidden
        className="absolute -bottom-72 -right-48 h-[700px] w-[700px] rounded-full bg-paper/[0.06]"
      />
      <div className="relative z-10 mx-auto max-w-[680px] px-5 sm:px-8">
        <span className="text-eyebrow text-eyebrow-paper">Únete al club</span>
        <h2 className="mt-3 mb-5 font-display font-normal leading-[1.05] tracking-[-0.03em] text-paper text-[clamp(40px,5vw,68px)]">
          Sé la <em>primera</em> en ver
          <br />
          las nuevas piezas.
        </h2>
        <p className="mx-auto mb-9 max-w-[520px] text-base leading-[1.6] opacity-85">
          Cada viernes subimos drops nuevos. Suscríbete y recibe acceso
          anticipado + 15% de descuento en tu primera compra.
        </p>
        <NewsletterForm />
        <p className="mt-5 text-[12px] tracking-[0.04em] opacity-70">
          Sin spam · Cancela cuando quieras · +12.000 suscritas
        </p>
      </div>
    </section>
  );
}
