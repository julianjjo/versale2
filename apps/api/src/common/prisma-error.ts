import { Prisma } from '@prisma/client';

type PrismaErrorHandlers = Partial<Record<string, () => never>>;

// Translates a Prisma write-conflict error (record not found, unique
// violation, FK restrict, ...) into whichever HTTP exception the caller maps
// its code to, and re-throws anything else — a different Prisma code, or a
// non-Prisma error — completely unchanged. Every call site needs its own
// message (and sometimes its own HTTP status) per code depending on what the
// write was trying to do, so this only owns the "is this actually a known
// Prisma error, and does the caller have a handler for this code" plumbing,
// not the messages themselves. Keeping that plumbing in one place is what
// stops the next Prisma-backed mutation from shipping without it.
export function translatePrismaError(
  error: unknown,
  handlers: PrismaErrorHandlers,
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlers[error.code]?.();
  }
  throw error;
}
