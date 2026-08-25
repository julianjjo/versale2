"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { Button } from "@/components/ui";
import type { Notification, PaginatedResponse } from "@/lib/types";

// Cheap enough to poll on a fixed interval instead of wiring up a socket:
// it's a single indexed count query, and the bell is the only surface that
// needs to learn about a status change without the buyer/seller reloading
// the page.
const UNREAD_COUNT_REFETCH_MS = 30_000;

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  // Header renders this component in both a desktop and a mobile container
  // (CSS `hidden`/`flex` picks which one shows), so two instances exist in
  // the DOM at once — a hardcoded id would collide and leave aria-controls
  // pointing at an ambiguous target.
  const panelId = useId();

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () =>
      (await api.get("/notifications/unread-count")).data,
    refetchInterval: UNREAD_COUNT_REFETCH_MS,
    staleTime: 60_000,
  });

  // Only fetched once the dropdown is actually opened — the badge count
  // above is what stays live in the background.
  const {
    data: list,
    isLoading,
    isError: isListError,
    refetch: refetchList,
  } = useQuery<PaginatedResponse<Notification>>({
    queryKey: ["notifications", "list"],
    queryFn: async () =>
      (await api.get("/notifications", { params: { limit: 10 } })).data,
    enabled: isOpen,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markAsRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: (err) =>
      setError(extractApiError(err, "No pudimos marcar la notificación como leída")),
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: invalidate,
    onError: (err) =>
      setError(
        extractApiError(err, "No pudimos marcar las notificaciones como leídas"),
      ),
  });

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const count = unread?.count ?? 0;
  const notifications = list?.data ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen((v) => !v);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={
          count > 0 ? `Notificaciones, ${count} sin leer` : "Notificaciones"
        }
        className="relative rounded-full p-2.5 text-text-primary transition-colors hover:bg-surface-muted"
      >
        <BellIcon />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-deep px-1 text-[10px] font-semibold leading-none text-text-inverse"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">
              Notificaciones
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead.mutate()}
                className="text-xs font-medium text-terracotta-deep hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">
                Cargando…
              </p>
            ) : isListError ? (
              // Regression: without this branch, a failed fetch left `data`
              // undefined, `notifications` fell back to [], and this render
              // dropped straight into the empty-state copy below —
              // indistinguishable from a genuinely empty inbox, with no way
              // to retry.
              <div className="px-4 py-6 text-center text-sm text-text-muted">
                <p>No pudimos cargar tus notificaciones.</p>
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() => refetchList()}
                >
                  Reintentar
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">
                No tienes notificaciones
              </p>
            ) : (
              <ul>
                {notifications.map((notification) => {
                  const onActivate = () => {
                    if (!notification.read) {
                      markAsRead.mutate(notification.id);
                    }
                  };
                  const itemClassName = `flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-surface-muted ${
                    notification.read
                      ? "text-text-muted"
                      : "font-medium text-text-primary"
                  }`;
                  const content = (
                    <>
                      {!notification.read && (
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta"
                        />
                      )}
                      <span>
                        {notification.message}
                        <span className="mt-1 block text-xs text-text-muted">
                          {new Date(notification.createdAt).toLocaleDateString(
                            "es-CO",
                            { timeZone: "UTC" },
                          )}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={notification.id}>
                      {/* Not every notification is about an order (e.g. a
                          future account-level one), so this only becomes a
                          link when there's actually somewhere to go —
                          otherwise it stays a plain mark-as-read button. */}
                      {notification.orderId ? (
                        <Link
                          href={`/orders/${notification.orderId}`}
                          onClick={() => {
                            setIsOpen(false);
                            onActivate();
                          }}
                          className={itemClassName}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onActivate}
                          className={itemClassName}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
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
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
