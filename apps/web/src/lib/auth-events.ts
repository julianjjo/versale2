type UnauthorizedHandler = () => void;

const handlers = new Set<UnauthorizedHandler>();

export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function notifyUnauthorized(): void {
  for (const handler of handlers) {
    try {
      handler();
    } catch {
      // Swallow individual handler errors so all subscribers still run.
    }
  }
}
