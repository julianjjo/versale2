"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div aria-live="polite">
      {submitted ? (
        <p className="mx-auto max-w-[480px] rounded-full bg-paper/[0.15] px-6 py-3.5 text-center text-sm font-medium text-paper">
          ¡Gracias por suscribirte! Revisa tu correo para confirmar. 🎉
        </p>
      ) : (
        <form
          className="mx-auto flex max-w-[480px] flex-col gap-2 rounded-[18px] bg-paper/[0.15] p-1.5 sm:flex-row sm:rounded-full"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Tu correo electrónico
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder="tu@email.com"
            className="flex-1 rounded-[14px] border-none bg-paper/[0.15] px-5 py-3.5 text-sm text-paper placeholder:text-paper/60 focus:outline-none sm:bg-transparent sm:rounded-full"
          />
          <button
            type="submit"
            className="rounded-[14px] bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2 sm:rounded-full"
          >
            Suscribirme
          </button>
        </form>
      )}
    </div>
  );
}
