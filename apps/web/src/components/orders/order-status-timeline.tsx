import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

// Cancellation can only happen from PENDING or PAID (see
// ALLOWED_STATUS_TRANSITIONS in lib/order-status.ts) — it's a branch off the
// happy path, not a fifth step on it, so it gets its own terminal state
// instead of a slot in the linear stepper below.
const TIMELINE_STEPS: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") {
    // No `role="status"` here: this renders on every load of an already-
    // cancelled order, not just the moment it happens. The live-region
    // announcement for an in-session cancel is owned by the confirmation
    // message next to the (now-gone) Cancelar button, not this summary.
    return (
      <p className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
        Pedido cancelado.
      </p>
    );
  }

  const reachedIndex = TIMELINE_STEPS.indexOf(status);
  const lastIndex = TIMELINE_STEPS.length - 1;

  return (
    <ol aria-label="Progreso del pedido" className="flex items-start">
      {TIMELINE_STEPS.map((step, index) => {
        const isReached = index <= reachedIndex;
        // The final step has nothing after it to be "in progress" toward —
        // once reached, it's done, not merely current, unlike every earlier
        // step (e.g. SHIPPED means "in transit", not finished).
        const isDone = index < reachedIndex || (isReached && index === lastIndex);
        const isCurrent = isReached && !isDone;
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 flex-col items-center text-center last:flex-none"
          >
            <div className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  isDone
                    ? "border-success bg-success text-white"
                    : isCurrent
                      ? "border-info bg-info/10 text-info"
                      : "border-border bg-surface text-text-muted"
                }`}
              >
                {isDone ? <CheckIcon /> : index + 1}
              </span>
              {index < TIMELINE_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-1 h-0.5 flex-1 ${isDone ? "bg-success" : "bg-border"}`}
                />
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                isDone || isCurrent ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {ORDER_STATUS_LABEL[step]}
              <span className="sr-only">
                {isDone ? " (completado)" : isCurrent ? " (actual)" : " (pendiente)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
