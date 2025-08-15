import type { LpAgentService as ILpAgentService } from '@domain/interfaces/lpagent.service.interface';
import { type LpAgentResponse, LpAgentResponseSchema, type LpAgentOverviewResponse, LpAgentOverviewResponseSchema } from '@schemas/lpagent.schema';
import type { z } from 'zod';
import { RateLimiter } from './rate-limiter.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';
import axios, { type AxiosResponse } from 'axios';

export class LpAgentService implements ILpAgentService {
  private static instance: LpAgentService;
  private static readonly BASE_URL = 'https://api.lpagent.io/open-api/v1';
  private static readonly TIMEOUT_MS = 30_000;
  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_RETRY_DELAY_MS = 10_000;
  private static readonly RETRY_MULTIPLIER = 3;

  private rateLimiter: RateLimiter;

  private constructor() {
    this.rateLimiter = new RateLimiter(12000);
    logger.debug('🎯 LpAgentService initialized with rate limiting');
  }

  static getInstance(): LpAgentService {
    if (!LpAgentService.instance) {
      LpAgentService.instance = new LpAgentService();
    }
    return LpAgentService.instance;
  }

  public async getOpeningPositions(): Promise<LpAgentResponse> {
    return this.rateLimiter.enqueue(async () => {
      return this.fetchWithRetry('/lp-positions/opening', LpAgentResponseSchema);
    });
  }

  public async getOverview(): Promise<LpAgentOverviewResponse> {
    return this.rateLimiter.enqueue(async () => {
      return this.fetchWithRetry('/lp-positions/overview?protocol=meteora', LpAgentOverviewResponseSchema);
    });
  }

  private async fetchWithRetry<T>(endpoint: string, schema: z.ZodSchema<T>, attempt = 1): Promise<T> {
    try {
      logger.debug(`📡 Fetching LpAgent ${endpoint} (attempt ${attempt}/${LpAgentService.MAX_RETRIES})`);

      const url = `${LpAgentService.BASE_URL}${endpoint}`;
      const params = new URLSearchParams();

      params.append('owner', config.solana.phase.wallet);

      const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;

      const response: AxiosResponse = await axios.get(fullUrl, {
        headers: {
          'x-api-key': config.lpagent.xAuth,
          'Content-Type': 'application/json',
        },
        timeout: LpAgentService.TIMEOUT_MS,
      });

      const validatedData = schema.parse(response.data);

      logger.info(`✅ Successfully fetched data from LpAgent ${endpoint}`);
      return validatedData;

    } catch (error) {
      const isRateLimitError = this.isRateLimitError(error);
      const shouldRetry = attempt < LpAgentService.MAX_RETRIES && (isRateLimitError || this.isRetryableError(error));

      if (shouldRetry) {
        const delay = LpAgentService.INITIAL_RETRY_DELAY_MS * Math.pow(LpAgentService.RETRY_MULTIPLIER, attempt - 1);

        logger.warn(
          `⚠️ LpAgent API error (attempt ${attempt}/${LpAgentService.MAX_RETRIES}). Retrying in ${delay / 1000}s...`,
          { error: error instanceof Error ? error.message : String(error) }
        );

        await this.delay(delay);
        return this.fetchWithRetry(endpoint, schema, attempt + 1);
      }

      logger.error(
        `❌ LpAgent API failed after ${attempt} attempts`,
        error instanceof Error ? error : new Error(String(error))
      );

      throw this.createDetailedError(error);
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return error.response?.status === 429;
    }
    return false;
  }

  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return !status || status >= 500;
    }
    return true;
  }

  private createDetailedError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const message = error.response?.data?.message || error.message;

      return new Error(
        `LpAgent API error: ${status} ${statusText} - ${message}`
      );
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
