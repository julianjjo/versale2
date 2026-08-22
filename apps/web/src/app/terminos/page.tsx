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
          de la transacción C2C, no un detalle técnico — el comprador ya pagó
          el envío porque está incluido en el precio. */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary">
          Envío de los productos
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted">
          <li>
            El costo del envío está <strong>incluido en el precio</strong> de
            cada prenda y lo paga el comprador al completar la compra; no hay
            cobros adicionales al momento de la entrega.
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
    </StaticPage>
  );
}
