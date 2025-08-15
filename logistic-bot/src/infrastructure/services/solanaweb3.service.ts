import { Connection, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { config } from '@infrastructure/config/env';
import { RateLimiter } from './rate-limiter.service';

export class SolanaWeb3Service {
  private static instance: SolanaWeb3Service;
  private connection: Connection;
  private rateLimiter: RateLimiter;
  private readonly MAX_RETRIES = 5;

  private constructor(connection?: Connection) {
    this.connection = connection ?? new Connection(config.solana.rpcEndpoint, 'finalized');
    // Default to conservative 300ms (~3.3 req/s) if not provided
    this.rateLimiter = new RateLimiter(300);
  }

  public static getInstance(): SolanaWeb3Service {
    if (!SolanaWeb3Service.instance) {
      SolanaWeb3Service.instance = new SolanaWeb3Service();
    }
    return SolanaWeb3Service.instance;
  }

  public getConnection(): Connection {
    return this.connection;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(fn: () => Promise<T>, label = 'request', maxRetries = this.MAX_RETRIES, baseDelayMs = 800): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        const isTransient = msg.includes('429') || msg.includes('too many requests') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('fetch') || msg.includes('long-term');
        if (!isTransient || attempt === maxRetries) {
          throw err;
        }
        const delay = Math.min(baseDelayMs * 2 ** attempt, 15000) + Math.floor(Math.random() * 400);
        if (attempt === 0) {
          console.warn(`${label}: transient error, retrying in ${delay}ms...`);
        }
        await this.sleep(delay);
        attempt++;
      }
    }
    throw lastErr as any;
  }

  public async getSignaturesForAddress(
    address: string,
    options?: {
      limit?: number;
      before?: string;
      until?: string;
    }
  ): Promise<any[]> {
    return await this.withRetry(
      () => this.rateLimiter.enqueue(async () => {
        const publicKey = new PublicKey(address);
        return await this.connection.getSignaturesForAddress(publicKey, options);
      }),
      'getSignaturesForAddress'
    );
  }

  public async getTransaction(signature: string): Promise<any> {
    return await this.withRetry(
      () => this.rateLimiter.enqueue(async () => {
        return await this.connection.getTransaction(signature, {
          commitment: 'finalized',
          maxSupportedTransactionVersion: 0,
        });
      }),
      'getTransaction'
    );
  }

  public async getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
    return await this.withRetry(
      () => this.rateLimiter.enqueue(async () => {
        return await this.connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });
      }),
      'getParsedTransaction'
    );
  }

  public async getTransactionsBatch(signatures: string[]): Promise<any[]> {
    if (signatures.length === 0) return [];

    const batchSize = 20;
    const results: any[] = [];

    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);

      const batchPromises = batch.map(signature =>
        this.rateLimiter.enqueue(async () => {
          return await this.connection.getTransaction(signature, {
            commitment: 'finalized',
            maxSupportedTransactionVersion: 0,
          });
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

    }

    return results;
  }

  public async getParsedTransactions(signatures: string[]): Promise<(ParsedTransactionWithMeta | null)[]> {
    if (signatures.length === 0) return [];

    const batchSize = 20;
    const results: (ParsedTransactionWithMeta | null)[] = [];

    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchResult = await this.withRetry(
        () => this.rateLimiter.enqueue(async () => {
          return await this.connection.getParsedTransactions(batch, {
            maxSupportedTransactionVersion: 0,
          });
        }),
        'getParsedTransactions'
      );
      results.push(...batchResult);
    }

    return results;
  }

  public async getAllSignaturesForAddress(
    address: string,
    options?: { pageLimit?: number; maxTotal?: number; stopOnCutoffEpochSec?: number | null }
  ): Promise<{ signature: string; blockTime: number | null }[]> {
    const pageLimit = options?.pageLimit ?? 50;
    const maxTotal = options?.maxTotal ?? 5000;
    const stopOnCutoff = options?.stopOnCutoffEpochSec ?? null;

    const collected: { signature: string; blockTime: number | null }[] = [];
    let before: string | undefined = undefined;

    while (collected.length < maxTotal) {
      const page = await this.withRetry(
        () => this.rateLimiter.enqueue(async () => {
          const publicKey = new PublicKey(address);
          return await this.connection.getSignaturesForAddress(publicKey, { limit: pageLimit, before });
        }),
        'getSignaturesForAddress'
      );
      if (!page || page.length === 0) break;

      for (const p of page) {
        collected.push({ signature: p.signature, blockTime: typeof p.blockTime === 'number' ? p.blockTime : null });
      }

      before = page[page.length - 1].signature as string;
      if (stopOnCutoff !== null) {
        const oldest = page[page.length - 1];
        const oldestTime = typeof oldest.blockTime === 'number' ? oldest.blockTime : null;
        if (oldestTime !== null && oldestTime < stopOnCutoff) {
          break;
        }
      }
    }

    return collected;
  }
}
