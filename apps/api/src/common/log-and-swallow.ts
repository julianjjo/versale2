import { Logger } from '@nestjs/common';

// Shared by any fire-and-forget side effect (an order notification, a
// product view-count increment) that has already done its real job and
// must never let a transient failure surface to the caller:
// `somePromise.catch(logAndSwallow(this.logger, "..."))` logs the error and
// discards it instead of throwing or leaving an unhandled rejection.
export function logAndSwallow(
  logger: Logger,
  message: string,
): (error: unknown) => void {
  return (error: unknown) => {
    logger.error(message, error as Error);
  };
}
