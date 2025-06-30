import pino from 'pino';
import { LoggerService } from '../../domain/ports/services';

export class PinoLogger implements LoggerService {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: true,
        }
      } : undefined,
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(meta, message);
  }

  error(message: string, error?: Error, meta?: any): void {
    this.logger.error({ error, ...meta }, message);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(meta, message);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(meta, message);
  }
}