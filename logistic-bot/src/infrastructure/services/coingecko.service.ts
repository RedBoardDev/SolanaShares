import { type TokenData, TokenDataSchema, type CachedTokenData } from '@schemas/token-data.schema';
import { logger } from '@helpers/logger';
import axios, { type AxiosResponse } from 'axios';

export class CoinGeckoService {
  private static instance: CoinGeckoService;
  private static readonly BASE_URL = 'https://api.coingecko.com/api/v3';
  private static readonly TIMEOUT_MS = 30_000;
  private static readonly CACHE_TTL_MS = 60_000;

  private tokenCache = new Map<string, CachedTokenData>();

  private constructor() {
    logger.debug('🎯 CoinGeckoService initialized');
  }

  static getInstance(): CoinGeckoService {
    if (!CoinGeckoService.instance) {
      CoinGeckoService.instance = new CoinGeckoService();
    }
    return CoinGeckoService.instance;
  }


  public async getTokenPrice(
    tokenId: string,
    includeMarketCap = true,
    include24hVol = true,
    include24hChange = true,
    includeLastUpdated = true
  ): Promise<TokenData | null> {
    try {
      const cachedData = this.getCachedTokenData(tokenId);
      if (cachedData) {
        logger.debug(`📦 Returning cached token data for ${tokenId}`, {
          lastUpdated: cachedData.lastUpdated,
          timeRemaining: this.getCacheTimeRemaining(tokenId)
        });
        return cachedData.data;
      }

      logger.debug(`🔍 Fetching fresh token data for ${tokenId}`);
      const url = `${CoinGeckoService.BASE_URL}/simple/price`;

      const params = new URLSearchParams({
        ids: tokenId,
        vs_currencies: 'usd',
        include_market_cap: includeMarketCap.toString(),
        include_24hr_vol: include24hVol.toString(),
        include_24hr_change: include24hChange.toString(),
        include_last_updated_at: includeLastUpdated.toString()
      });

      const response: AxiosResponse = await axios.get(`${url}?${params}`, {
        timeout: CoinGeckoService.TIMEOUT_MS,
        headers: {
          'accept': 'application/json',
          'User-Agent': 'SolDecoder-Bot/1.0'
        }
      });

      const responseData = response.data;
      const tokenData = responseData[tokenId];

      if (!tokenData) {
        logger.error(`❌ Token ${tokenId} not found in response`);
        return null;
      }

      const validatedData = TokenDataSchema.parse(tokenData);

      this.cacheTokenData(tokenId, validatedData);

      logger.info(`✅ Successfully fetched and cached token data for ${tokenId}`, {
        usd: validatedData.usd,
        marketCap: validatedData.usd_market_cap,
        volume24h: validatedData.usd_24h_vol
      });

      return validatedData;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`❌ CoinGecko API error for ${tokenId}`, error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
      } else {
        logger.error(`❌ Failed to fetch token data for ${tokenId}`, error as Error);
      }
      return null;
    }
  }


  public async getMultipleTokenPrices(
    tokenIds: string[],
    includeMarketCap = true,
    include24hVol = true,
    include24hChange = true,
    includeLastUpdated = true
  ): Promise<Record<string, TokenData> | null> {
    try {
      if (tokenIds.length === 0) {
        logger.warn('⚠️ No token IDs provided for multiple token prices request');
        return null;
      }

      logger.debug(`🔍 Fetching fresh data for multiple tokens: ${tokenIds.join(', ')}`);
      const url = `${CoinGeckoService.BASE_URL}/simple/price`;

      const params = new URLSearchParams({
        ids: tokenIds.join(','),
        vs_currencies: 'usd',
        include_market_cap: includeMarketCap.toString(),
        include_24hr_vol: include24hVol.toString(),
        include_24hr_change: include24hChange.toString(),
        include_last_updated_at: includeLastUpdated.toString()
      });

      const response: AxiosResponse = await axios.get(`${url}?${params}`, {
        timeout: CoinGeckoService.TIMEOUT_MS,
        headers: {
          'accept': 'application/json',
          'User-Agent': 'SolDecoder-Bot/1.0'
        }
      });

      const responseData = response.data;
      const result: Record<string, TokenData> = {};

      for (const tokenId of tokenIds) {
        const tokenData = responseData[tokenId];
        if (tokenData) {
          const validatedData = TokenDataSchema.parse(tokenData);
          result[tokenId] = validatedData;

          this.cacheTokenData(tokenId, validatedData);
        } else {
          logger.warn(`⚠️ Token ${tokenId} not found in response`);
        }
      }

      logger.info(`✅ Successfully fetched data for ${Object.keys(result).length}/${tokenIds.length} tokens`);

      return result;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`❌ CoinGecko API error for multiple tokens`, error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
      } else {
        logger.error(`❌ Failed to fetch multiple token data`, error as Error);
      }
      return null;
    }
  }


  private getCachedTokenData(tokenId: string): CachedTokenData | null {
    const cached = this.tokenCache.get(tokenId);
    if (!cached) return null;

    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CoinGeckoService.CACHE_TTL_MS;

    if (isExpired) {
      this.tokenCache.delete(tokenId);
      logger.debug(`🗑️ Removed expired cache for ${tokenId}`);
      return null;
    }

    return cached;
  }

  private cacheTokenData(tokenId: string, data: TokenData): void {
    const now = Date.now();
    const cachedData: CachedTokenData = {
      data,
      timestamp: now,
      lastUpdated: new Date(now).toISOString()
    };

    this.tokenCache.set(tokenId, cachedData);
    logger.debug(`💾 Cached token data for ${tokenId}`, {
      timestamp: cachedData.lastUpdated
    });
  }

  public getCacheTimeRemaining(tokenId: string): number {
    const cached = this.tokenCache.get(tokenId);
    if (!cached) return 0;

    const elapsed = Date.now() - cached.timestamp;
    const remaining = Math.max(0, CoinGeckoService.CACHE_TTL_MS - elapsed);
    return Math.ceil(remaining / 1000);
  }

  public getCacheInfo(tokenId: string): { lastUpdated: string; remainingSeconds: number } | null {
    const cached = this.tokenCache.get(tokenId);
    if (!cached) return null;

    return {
      lastUpdated: cached.lastUpdated,
      remainingSeconds: this.getCacheTimeRemaining(tokenId)
    };
  }

  public clearCache(tokenId?: string): void {
    if (tokenId) {
      this.tokenCache.delete(tokenId);
      logger.debug(`🗑️ Cleared cache for ${tokenId}`);
    } else {
      this.tokenCache.clear();
      logger.debug('🗑️ Cleared all token cache');
    }
  }
}
