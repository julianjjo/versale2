import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Términos — Versale" };

export default function TerminosPage() {
  return (
    <StaticPage
      title="Términos y condiciones"
      intro="Estamos redactando los términos y condiciones de Versale antes del lanzamiento. Esta página se actualizará con el texto completo próximamente."
    >
      {/* Ítem 13 (decisión cerrada 2.3): la responsabilidad del envío es parte
          de la transacción C2C, no un detalle técnico. El envío se cobra por
          separado (no es gratis ni está incluido en el precio de la prenda):
          este texto debe reflejar exactamente lo que ya hacen
          apps/web/src/app/cart/page.tsx y apps/web/src/app/orders/[id]/page.tsx,
          donde el total mostrado es "sin envío" y el costo se acuerda
          directamente entre comprador y vendedor. */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          Envío de los productos
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted">
          <li>
            El costo del envío <strong>no está incluido</strong> en el precio
            de la prenda: se acuerda y se paga directamente entre comprador y
            vendedor al momento de la entrega.
          </li>
          <li>
            Es <strong>responsabilidad exclusiva del vendedor</strong> enviar
            la prenda una vez confirmado el pago. El vendedor marca el pedido
            como &laquo;Enviado&raquo; desde su panel de ventas.
          </li>
          <li>
            Si un vendedor no envía un pedido pagado dentro de{" "}
            <strong>7 días</strong>, el monto se reembolsa automáticamente al
            comprador.
          </li>
          <li>
            Recibida la prenda, el comprador cuenta con{" "}
            <strong>48 horas</strong> para abrir una disputa si esta no
            coincide con la descripción o las fotos publicadas. Las disputas
            se resuelven por nuestro equipo; ver también nuestra{" "}
            <a href="/privacidad" className="underline underline-offset-4">
              Política de privacidad
            </a>
            .
          </li>
        </ul>
      </section>
      {/* Ítem 15 (decisión cerrada 3.3): la monetización se declara antes de
          tocar dinero. Revisar al activar cobros reales (3.1). */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          Comisiones
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Durante la fase de validación de Versale,{" "}
          <strong>
            no cobramos ninguna comisión ni al vendedor ni al comprador
          </strong>{" "}
          — el precio que ves es el precio de la prenda. Si en el futuro
          introducimos comisiones, lo anunciaremos en esta página y en la
          plataforma con antelación antes de aplicarlas.
        </p>
      </section>
    </StaticPage>
  );
}
