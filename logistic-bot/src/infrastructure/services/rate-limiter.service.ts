import { logger } from '@helpers/logger';

export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly intervalMs: number;

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue().catch((err) => {
        logger.error('RateLimiter processing error', err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await job();
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
    this.processing = false;
  }
}
