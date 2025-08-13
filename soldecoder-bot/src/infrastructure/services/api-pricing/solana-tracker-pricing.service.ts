import type { PriceData } from '@schemas/price-data.schema';
import { config } from '@infrastructure/config/env';
import { SolanaTrackerApiClient } from '@infrastructure/services/api-pricing/solana-tracker-api-client';
import { ApiLoadBalancer } from '@infrastructure/services/api-pricing/api-load-balancer';
import { logger } from '@helpers/logger';

export class SolanaTrackerPricingService {
  private static instance: SolanaTrackerPricingService;
  private readonly loadBalancer: ApiLoadBalancer;

  private constructor() {
    const primaryClient = new SolanaTrackerApiClient(
      config.solana.trackerApiKeys.primary,
      'PRIMARY'
    );

    const secondaryClient = new SolanaTrackerApiClient(
      config.solana.trackerApiKeys.secondary,
      'SECONDARY'
    );

    this.loadBalancer = new ApiLoadBalancer([primaryClient, secondaryClient]);

  }

  public static getInstance(): SolanaTrackerPricingService {
    if (!SolanaTrackerPricingService.instance) {
      SolanaTrackerPricingService.instance = new SolanaTrackerPricingService();
    }
    return SolanaTrackerPricingService.instance;
  }

  public async getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<PriceData | null> {
    try {
      const historicalPrice = await this.loadBalancer.getHistoricalPrice(tokenAddress, timestamp);
      if (historicalPrice) {
        logger.debug('✅ Historical price found', { token: tokenAddress, price: historicalPrice.price });
        return historicalPrice;
      }

      logger.debug('🔄 Historical price failed, trying current price fallback', { token: tokenAddress });
      const currentPrice = await this.loadBalancer.getCurrentPrice(tokenAddress);

      if (currentPrice) {
        const fallbackPrice: PriceData = {
          ...currentPrice,
          timestamp: timestamp,
        };

        return fallbackPrice;
      }

      logger.warn('⚠️ All pricing strategies failed', { token: tokenAddress, timestamp });
      return null;

    } catch (error) {
      logger.error('❌ Fatal error in getHistoricalPrice', error as Error, {
        token: tokenAddress,
        timestamp,
      });
      return null;
    }
  }

  public async getCurrentPrice(tokenAddress: string): Promise<PriceData | null> {
    try {
      logger.debug('🔍 Getting current price', { token: tokenAddress });

      const result = await this.loadBalancer.getCurrentPrice(tokenAddress);

      if (result) {
        logger.debug('✅ Current price retrieved', { token: tokenAddress, price: result.price });
      } else {
        logger.warn('⚠️ Current price not found', { token: tokenAddress });
      }

      return result;

    } catch (error) {
      logger.error('❌ Fatal error in getCurrentPrice', error as Error, {
        token: tokenAddress,
      });
      return null;
    }
  }

  public async getBatchHistoricalPrices(
    requests: Array<{ tokenAddress: string; timestamp: number }>
  ): Promise<Array<PriceData | null>> {
    if (requests.length === 0) return [];

    try {
      const results = await this.loadBalancer.getBatchHistoricalPrices(requests);
      const failed = results.filter(r => r === null).length;

      if (failed > 0) {
        await this.processBatchFallbacks(requests, results);
      }

      return results;

    } catch (error) {
      logger.error('❌ Fatal error in getBatchHistoricalPrices', error as Error, {
        requestCount: requests.length,
      });
      return new Array(requests.length).fill(null);
    }
  }


  private async processBatchFallbacks(
    originalRequests: Array<{ tokenAddress: string; timestamp: number }>,
    results: Array<PriceData | null>
  ): Promise<void> {
    const fallbackPromises: Promise<void>[] = [];

    for (let i = 0; i < results.length; i++) {
      if (results[i] === null) {
        const request = originalRequests[i];

        const fallbackPromise = this.loadBalancer.getCurrentPrice(request.tokenAddress)
          .then(currentPrice => {
            if (currentPrice) {
              results[i] = {
                ...currentPrice,
                timestamp: request.timestamp,
              };
              logger.debug('✅ Fallback successful', {
                token: request.tokenAddress,
                price: currentPrice.price
              });
            }
          })
          .catch(error => {
            logger.warn('⚠️ Fallback failed', {
              token: request.tokenAddress,
              error: error instanceof Error ? error.message : String(error),
            });
          });

        fallbackPromises.push(fallbackPromise);
      }
    }

    if (fallbackPromises.length > 0) {
      await Promise.allSettled(fallbackPromises);
    }
  }

  public getServiceStats() {
    return {
      loadBalancer: this.loadBalancer.getStats(),
      config: {
        hasPrimaryKey: !!config.solana.trackerApiKeys.primary,
        hasSecondaryKey: !!config.solana.trackerApiKeys.secondary,
      },
      features: {
        dualApiKeys: true,
        loadBalancing: true,
        fallbackStrategies: true,
        batchProcessing: true,
      },
    };
  }
}
