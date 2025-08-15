import { logger } from "./logger";

export function setupErrorHandler(): void {
  process.on('uncaughtException', (err: Error) => {
    logger.fatal('Uncaught exception', err);
    setTimeout(() => process.exit(1), 100);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof Error) {
      logger.error('Unhandled promise rejection', reason);
    } else {
      logger.error('Unhandled promise rejection', undefined, { reason });
    }
  });
}
