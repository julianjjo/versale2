import type { Metadata } from "next";
import { StaticPage } from "@/components/layout/static-page";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacidad — Versale" };

// Item 8: promising deletion without a mechanism is worse than not promising
// it. The mechanism today is an email request — rendered only while the
// contact address is actually configured, so the page never shows a dead link.
function AccountDeletionSection() {
  const mailto = contactMailto("Eliminar mi cuenta de Versale");
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary">
        Eliminación de cuenta
      </h2>
      {CONTACT_EMAIL ? (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Puedes pedir la eliminación definitiva de tu cuenta escribiendo a{" "}
          <a
            href={mailto ?? undefined}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          con el asunto «Eliminar mi cuenta». Eliminamos tus datos personales y
          te confirmamos por correo.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          El canal de eliminación de cuentas estará disponible próximamente en
          esta página.
        </p>
      )}
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
