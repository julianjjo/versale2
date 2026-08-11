import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";

export const metadata: Metadata = { title: "Centro de ayuda — Versale" };

const FAQS = [
  {
    question: "¿Cómo compro en Versale?",
    answer:
      "Explora el catálogo, filtra por talla, marca, categoría o precio, agrega lo que te guste al carrito y completa el pago para recibir tu pedido.",
  },
  {
    question: "¿Cómo vendo una prenda?",
    answer:
      "Publica tu prenda desde \"Vender\". Un administrador revisa cada publicación y la aprueba antes de que aparezca en el catálogo.",
  },
  {
    question: "¿Cómo hago seguimiento a mi pedido?",
    answer:
      "Revisa el estado en \"Mis pedidos\": Pendiente, Pagado, Enviado, Entregado o Cancelado.",
  },
  {
    question: "¿Puedo dejar una reseña?",
    answer:
      "Sí, califica y comenta un producto desde su página de detalle después de comprarlo.",
  },
];

export default function AyudaPage() {
  return (
    <StaticPage
      title="Centro de ayuda"
      intro="Respuestas rápidas sobre cómo comprar, vender y hacer seguimiento a tus pedidos en Versale."
    >
      <dl className="space-y-6">
        {FAQS.map((faq) => (
          <div key={faq.question}>
            <dt className="font-medium text-text-primary">{faq.question}</dt>
            <dd className="mt-1">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </StaticPage>
  );
}
