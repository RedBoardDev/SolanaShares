import { type PriceData, PriceDataSchema, CurrentPriceDataSchema } from '@schemas/price-data.schema';
import { RateLimiter } from '@infrastructure/services/rate-limiter.service';
import { logger } from '@helpers/logger';

export class SolanaTrackerApiClient {
  private static readonly BASE_URL = 'https://data.solanatracker.io';
  private static readonly TIMEOUT_MS = 60000;
  private static readonly MAX_RETRIES = 3;

  private readonly rateLimiter: RateLimiter;
  private readonly apiKey: string;
  private readonly instanceId: string;

  constructor(apiKey: string, instanceId: string) {
    this.apiKey = apiKey;
    this.instanceId = instanceId;
    this.rateLimiter = new RateLimiter(1400);
  }

  public async getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<PriceData | null> {
    return this.rateLimiter.enqueue(() => this.executeHistoricalPriceRequest(tokenAddress, timestamp));
  }

  public async getCurrentPrice(tokenAddress: string): Promise<PriceData | null> {
    return this.rateLimiter.enqueue(() => this.executeCurrentPriceRequest(tokenAddress));
  }

  private async executeHistoricalPriceRequest(tokenAddress: string, timestamp: number): Promise<PriceData | null> {
    const url = `${SolanaTrackerApiClient.BASE_URL}/price/history/timestamp`;
    const params = { token: tokenAddress, timestamp: timestamp.toString() };

    for (let attempt = 1; attempt <= SolanaTrackerApiClient.MAX_RETRIES; attempt++) {
      try {
        logger.debug(`🔍 [${this.instanceId}] Historical price attempt ${attempt}/${SolanaTrackerApiClient.MAX_RETRIES}`, {
          token: tokenAddress,
          timestamp,
        });

        const rawData = await this.makeRequest(url, params);
        const result = PriceDataSchema.parse(rawData);

        logger.debug(`✅ [${this.instanceId}] Historical price retrieved`, { token: tokenAddress, price: result.price });
        return result;

      } catch (error) {
        if (await this.handleError(error, attempt, SolanaTrackerApiClient.MAX_RETRIES, tokenAddress, 'historical')) {
          continue;
        }
        return null;
      }
    }
    return null;
  }

  private async executeCurrentPriceRequest(tokenAddress: string): Promise<PriceData | null> {
    const url = `${SolanaTrackerApiClient.BASE_URL}/price`;
    const params = { token: tokenAddress };

    for (let attempt = 1; attempt <= SolanaTrackerApiClient.MAX_RETRIES; attempt++) {
      try {
        logger.debug(`🔍 [${this.instanceId}] Current price attempt ${attempt}/${SolanaTrackerApiClient.MAX_RETRIES}`, {
          token: tokenAddress,
        });

        const rawData = await this.makeRequest(url, params);
        const currentPrice = CurrentPriceDataSchema.parse(rawData);

        const result: PriceData = {
          timestamp: Math.floor(currentPrice.lastUpdated / 1000),
          price: currentPrice.price,
          closest_timestamp: currentPrice.lastUpdated,
          closest_timestamp_unix: Math.floor(currentPrice.lastUpdated / 1000),
          pool: 'current-price-fallback',
        };

        logger.debug(`✅ [${this.instanceId}] Current price retrieved`, { token: tokenAddress, price: result.price });
        return result;

      } catch (error) {
        if (await this.handleError(error, attempt, SolanaTrackerApiClient.MAX_RETRIES, tokenAddress, 'current')) {
          continue;
        }
        return null;
      }
    }
    return null;
  }

  private async makeRequest(url: string, params: Record<string, string>): Promise<any> {
    const searchParams = new URLSearchParams(params);
    const fullUrl = `${url}?${searchParams}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SolanaTrackerApiClient.TIMEOUT_MS);

    try {
      const response = await fetch(fullUrl, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(response.status, response.statusText);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async handleError(
    error: unknown,
    attempt: number,
    maxRetries: number,
    tokenAddress: string,
    requestType: 'historical' | 'current'
  ): Promise<boolean> {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`⏰ [${this.instanceId}] ${requestType} request timed out (${SolanaTrackerApiClient.TIMEOUT_MS}ms)`, {
        token: tokenAddress,
        attempt,
      });
      return attempt < maxRetries;
    }

    if (error instanceof ApiError) {
      if (error.status === 404) {
        logger.debug(`📍 [${this.instanceId}] ${requestType} data not found`, { token: tokenAddress });
        return false;
      }

      if (error.status === 429) {
        logger.warn(`🚫 [${this.instanceId}] Rate limit hit`, { attempt, token: tokenAddress });
        return attempt < maxRetries;
      }


      if (error.status >= 500) {
        logger.warn(`⚠️ [${this.instanceId}] Server error ${error.status}`, { attempt, token: tokenAddress });
        return attempt < maxRetries;
      }

      logger.error(`❌ [${this.instanceId}] API error ${error.status}: ${error.message}`, undefined, { token: tokenAddress });
      return false;
    }

    if (error instanceof Error && error.name === 'ZodError' && error.message.includes('Historical price data not available')) {
      logger.debug(`📍 [${this.instanceId}] No ${requestType} data available (API returned nulls)`, { token: tokenAddress });
      return false;
    }

    logger.warn(`⚠️ [${this.instanceId}] Unknown ${requestType} error`, {
      token: tokenAddress,
      attempt,
      error: error instanceof Error ? error.message : String(error),
    });

    if (attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt) * 1000;
      logger.debug(`⏰ [${this.instanceId}] Waiting ${delayMs}ms before retry`);
      await this.delay(delayMs);
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getInstanceId(): string {
    return this.instanceId;
  }
}

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
