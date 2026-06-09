"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="mx-auto flex max-w-[480px] flex-col gap-2 rounded-[18px] bg-paper/[0.15] p-1.5 sm:flex-row sm:rounded-full"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      aria-live="polite"
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Tu correo electrónico
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder={submitted ? "¡Gracias! 🎉" : "tu@email.com"}
        className="flex-1 rounded-[14px] border-none bg-paper/[0.15] px-5 py-3.5 text-sm text-paper placeholder:text-paper/60 focus:outline-none sm:bg-transparent sm:rounded-full"
      />
      <button
        type="submit"
        className="rounded-[14px] bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2 sm:rounded-full"
      >
        {submitted ? "Listo" : "Suscribirme"}
      </button>
    </form>
  );
}
