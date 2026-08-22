"use client";

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";

// Lives apart from the `ui` barrel so that importing `PageContainer` or
// `EmptyState` from a server component (the 404 page, every static page) does
// not drag a client boundary — and the effects below — into pages that are
// pure prose.

// Same selector the mobile-menu dialog in `layout/header.tsx` uses.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // An Effect Event instead of closing over `onClose` directly, so the effect
  // below can depend on `open` alone. Its only consumer today passes an
  // inline arrow function as `onClose`, which gets a new identity on every
  // render; if the effect depended on it too, every unrelated re-render while
  // the dialog is open (e.g. typing in a field inside it) would tear it down
  // and re-run it — yanking focus back to the first focusable element
  // mid-keystroke. Unlike a ref synced from a separate passive effect, an
  // Effect Event always sees the latest `onClose` as of the last render, with
  // no window where a keydown between commit and that effect's flush would
  // still reach a stale closure — e.g. one that captured `reject.isPending`
  // as `false` from just before the reject mutation started.
  const handleClose = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    // Remember who opened the dialog so focus can go back there on close;
    // otherwise it falls to <body> and a keyboard user restarts from the top.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusable()[0] ?? panel).focus();

    // `aria-modal="true"` promises assistive tech that the rest of the page is
    // inert, so Tab has to actually stay inside the panel.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Re-queried per keypress: the panel's content is caller-supplied and
      // buttons flip between enabled and disabled while a mutation is running.
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Stop the obscured page from scrolling behind the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_20px_50px_-20px_rgba(26,26,26,0.25)] focus:outline-none"
      >
        <h2 id={titleId} className="heading-card pr-10 text-text-primary">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        {/* Last in DOM, not first: it keeps the panel's own first focusable
            control (the field a caller actually wants filled, or in the zoom
            modal's case nothing else) as the initial-focus target, while
            still giving every dialog — including image-only ones with no
            "Cancelar" of their own — a close affordance a user can see and
            reach, instead of only Escape or a click on the unlabeled
            backdrop. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
