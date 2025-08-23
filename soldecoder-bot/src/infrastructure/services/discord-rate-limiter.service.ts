import { logger } from '@helpers/logger';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  queue: Array<{
    execute: () => Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
}

/**
 * Discord rate limit management service.
 * Implements a token bucket algorithm to comply with Discord's rate limits.
 */
export class DiscordRateLimiterService {
  private static instance: DiscordRateLimiterService;

  private static readonly RATE_LIMITS = {
    MESSAGE_SEND: { tokens: 5, refillMs: 5000 },
    MESSAGE_EDIT: { tokens: 5, refillMs: 5000 },
    MESSAGE_DELETE: { tokens: 5, refillMs: 5000 },
    CHANNEL_FETCH: { tokens: 5, refillMs: 1000 },
  } as const;

  private buckets = new Map<string, RateLimitBucket>();

  private globalRateLimitUntil: number | null = null;

  private constructor() {
    setInterval(() => this.cleanupInactiveBuckets(), 5 * 60 * 1000);
  }

  static getInstance(): DiscordRateLimiterService {
    if (!DiscordRateLimiterService.instance) {
      DiscordRateLimiterService.instance = new DiscordRateLimiterService();
    }
    return DiscordRateLimiterService.instance;
  }

  async executeWithRateLimit<T>(
    operation: () => Promise<T>,
    type: keyof typeof DiscordRateLimiterService.RATE_LIMITS,
    resourceId: string,
  ): Promise<T> {
    if (this.globalRateLimitUntil && Date.now() < this.globalRateLimitUntil) {
      const waitMs = this.globalRateLimitUntil - Date.now();
      logger.debug('Waiting for global rate limit', { waitMs, type, resourceId });
      await this.delay(waitMs);
    }

    const bucketKey = `${type}:${resourceId}`;
    const bucket = this.getOrCreateBucket(bucketKey, type);

    return new Promise<T>((resolve, reject) => {
      const task = {
        execute: async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            if (this.isRateLimitError(error)) {
              this.handleRateLimitError(error);
            }
            reject(error);
          }
        },
        resolve: () => resolve(undefined as unknown as T),
        reject,
      };

      bucket.queue.push(task);
      this.processBucket(bucketKey, type);
    });
  }

  private async processBucket(
    bucketKey: string,
    type: keyof typeof DiscordRateLimiterService.RATE_LIMITS,
  ): Promise<void> {
    const bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.queue.length === 0) return;

    const limit = DiscordRateLimiterService.RATE_LIMITS[type];
    const now = Date.now();
    const timeSinceRefill = now - bucket.lastRefill;

    if (timeSinceRefill >= limit.refillMs) {
      bucket.tokens = limit.tokens;
      bucket.lastRefill = now;
    }

    while (bucket.queue.length > 0 && bucket.tokens > 0) {
      const task = bucket.queue.shift();
      if (!task) continue;
      bucket.tokens--;

      await task.execute();
    }

    if (bucket.queue.length > 0) {
      const nextRefillMs = limit.refillMs - (Date.now() - bucket.lastRefill);
      setTimeout(() => this.processBucket(bucketKey, type), Math.max(100, nextRefillMs));
    }
  }

  private getOrCreateBucket(key: string, type: keyof typeof DiscordRateLimiterService.RATE_LIMITS): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      const limit = DiscordRateLimiterService.RATE_LIMITS[type];
      bucket = {
        tokens: limit.tokens,
        lastRefill: Date.now(),
        queue: [],
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  private isRateLimitError(error: unknown): boolean {
    const err = error as { code?: number; status?: number };
    return err?.code === 429 || err?.status === 429;
  }

  private handleRateLimitError(error: unknown): void {
    const err = error as { retry_after?: number; retryAfter?: number; global?: boolean; scope?: string };
    const retryAfter = err.retry_after || err.retryAfter;

    if (retryAfter) {
      const retryAfterMs = retryAfter * 1000;

      if (err.global) {
        this.globalRateLimitUntil = Date.now() + retryAfterMs;
        logger.warn('Global Discord rate limit hit', { retryAfterMs });
      }

      logger.debug('Discord rate limit hit', {
        retryAfterMs,
        global: err.global || false,
        scope: err.scope || 'unknown',
      });
    }
  }

  private cleanupInactiveBuckets(): void {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.queue.length === 0 && now - bucket.lastRefill > inactiveThreshold) {
        this.buckets.delete(key);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async sendMessage<T>(channelId: string, operation: () => Promise<T>): Promise<T> {
    return this.executeWithRateLimit(operation, 'MESSAGE_SEND', channelId);
  }

  async editMessage<T>(messageId: string, operation: () => Promise<T>): Promise<T> {
    return this.executeWithRateLimit(operation, 'MESSAGE_EDIT', messageId);
  }

  async deleteMessage<T>(messageId: string, operation: () => Promise<T>): Promise<T> {
    return this.executeWithRateLimit(operation, 'MESSAGE_DELETE', messageId);
  }

  async fetchChannel<T>(channelId: string, operation: () => Promise<T>): Promise<T> {
    return this.executeWithRateLimit(operation, 'CHANNEL_FETCH', channelId);
  }

  getRateLimitStatus(): {
    buckets: number;
    globalRateLimitActive: boolean;
    globalRateLimitUntil: number | null;
  } {
    return {
      buckets: this.buckets.size,
      globalRateLimitActive: this.globalRateLimitUntil !== null && Date.now() < this.globalRateLimitUntil,
      globalRateLimitUntil: this.globalRateLimitUntil,
    };
  }
}
