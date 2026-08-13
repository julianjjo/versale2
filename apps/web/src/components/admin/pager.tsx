"use client";

import { Button } from "@/components/ui";

/**
 * Prev/next pager shared by the admin panels.
 *
 * Bounds are checked against `page` rather than the server's `meta.page`:
 * `keepPreviousData` keeps the previous meta on screen while the next one is in
 * flight, and a fast double click on that stale value skipped a page.
 */
export function Pager({
  page,
  pages,
  isFetching = false,
  onPageChange,
}: {
  page: number;
  pages: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="secondary"
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        ‹ Anterior
      </Button>
      <span className="text-sm text-text-muted">
        Página {page} de {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages || isFetching}
        onClick={() => onPageChange(Math.min(pages, page + 1))}
      >
        Siguiente ›
      </Button>
    </div>
  );
}
