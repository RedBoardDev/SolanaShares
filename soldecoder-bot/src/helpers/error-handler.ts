import { logger } from "./logger";

export function setupErrorHandler(): void {
  // Bridge console.* to our logger so everything ends up dans nos fichiers datés
  const originalConsole = { ...console };
  console.debug = (...args: any[]) => logger.debug(args.map(String).join(' '));
  console.log = (...args: any[]) => logger.info(args.map(String).join(' '));
  console.info = (...args: any[]) => logger.info(args.map(String).join(' '));
  console.warn = (...args: any[]) => logger.warn(args.map(String).join(' '));
  console.error = (...args: any[]) => logger.error(args.map(String).join(' '));

  process.on('uncaughtException', (err: Error) => {
    logger.fatal('Uncaught exception', err);
    // allow logger to flush
    setTimeout(() => process.exit(1), 100);
  });

  process.on('uncaughtExceptionMonitor', (err: Error) => {
    logger.error('Uncaught exception (monitor)', err);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof Error) {
      logger.error('Unhandled promise rejection', reason);
    } else {
      logger.error('Unhandled promise rejection', undefined, { reason });
    }
  });

  process.on('rejectionHandled', (promise: Promise<any>) => {
    logger.warn('Promise rejection handled after the fact', { promise: String(promise) } as any);
  });

  // multipleResolves handled in promise-diagnostics with creation stack enrichment

  process.on('warning', (warning: Error & { name: string; code?: string; stack?: string }) => {
    const code = (warning as any).code;
    // Ignore deprecation of multipleResolves event to reduce noise
    if (code === 'DEP0160') return;
    logger.warn('Node process warning', { name: warning.name, code, message: warning.message, stack: warning.stack } as any);
  });

  process.on('beforeExit', (code: number) => {
    logger.info('Process beforeExit', { code });
  });

  process.on('exit', (code: number) => {
    logger.info('Process exiting', { code });
  });
}
