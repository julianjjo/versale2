import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacidad — Versale" };

// Item 8: promising deletion without a mechanism is worse than not promising
// it. The mechanism is now self-service (Perfil → «Eliminar mi cuenta»,
// confirmada con la contraseña); the email channel remains as a fallback for
// anyone who cannot access their account, rendered only while the contact
// address is actually configured, so the page never shows a dead link.
function AccountDeletionSection() {
  const mailto = contactMailto("Eliminar mi cuenta de Versale");
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary">
        Eliminación de cuenta
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Puedes eliminar tu cuenta tú mismo, en cualquier momento: entra en{" "}
        <a
          href="/profile"
          className="font-medium text-terracotta underline-offset-4 hover:underline"
        >
          tu perfil
        </a>{" "}
        y usa «Eliminar mi cuenta» (te pediremos tu contraseña para
        confirmarla). Tu perfil pasará a mostrarse como «Usuario eliminado»,
        retiraremos tus datos personales —correo, nombre, contraseñas,
        direcciones de envío conservadas— y retiraremos del catálogo tus
        publicaciones activas. Tus pedidos se conservan únicamente como
        registro contable de la compra y las reseñas ya publicadas quedan a
        nombre de «Usuario eliminado».
      </p>
      {CONTACT_EMAIL ? (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Si no puedes entrar a tu cuenta, escríbenos a{" "}
          <a
            href={mailto ?? undefined}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          con el asunto «Eliminar mi cuenta» y la tramitamos manualmente.
        </p>
      ) : null}
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <StaticPage
      title="Política de privacidad"
      intro="Estamos redactando la política de privacidad de Versale antes del lanzamiento. Esta página se actualizará con el texto completo próximamente."
    >
      <AccountDeletionSection />
    </StaticPage>
  );
}
