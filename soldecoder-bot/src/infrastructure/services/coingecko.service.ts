import { type NftData, NftDataSchema, type CachedNftData } from '@schemas/nft-data.schema';
import { logger } from '@helpers/logger';
import axios, { type AxiosResponse } from 'axios';

export class CoinGeckoService {
  private static instance: CoinGeckoService;
  private static readonly BASE_URL = 'https://api.coingecko.com/api/v3';
  private static readonly TIMEOUT_MS = 30000;
  private static readonly CACHE_TTL_MS = 60_000;

  private nftCache = new Map<string, CachedNftData>();

  private constructor() {
    logger.debug('🎯 CoinGeckoService initialized');
  }

  static getInstance(): CoinGeckoService {
    if (!CoinGeckoService.instance) {
      CoinGeckoService.instance = new CoinGeckoService();
    }
    return CoinGeckoService.instance;
  }

  public async getNftData(collectionId: string): Promise<NftData | null> {
    try {
      const cachedData = this.getCachedNftData(collectionId);
      if (cachedData) {
        logger.debug(`📦 Returning cached NFT data for ${collectionId}`, {
          lastUpdated: cachedData.lastUpdated,
          timeRemaining: this.getCacheTimeRemaining(collectionId)
        });
        return cachedData.data;
      }

      logger.debug(`🔍 Fetching fresh NFT data for ${collectionId}`);
      const url = `${CoinGeckoService.BASE_URL}/nfts/${collectionId}`;

      const response: AxiosResponse = await axios.get(url, {
        timeout: CoinGeckoService.TIMEOUT_MS,
        headers: {
          'accept': 'application/json',
          'User-Agent': 'SolDecoder-Bot/1.0'
        }
      });

      const nftData = NftDataSchema.parse(response.data);

      this.cacheNftData(collectionId, nftData);

      return nftData;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`❌ CoinGecko API error for ${collectionId}`, error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url
        });
      } else {
        logger.error(`❌ Failed to fetch NFT data for ${collectionId}`, error as Error);
      }
      return null;
    }
  }

  private getCachedNftData(collectionId: string): CachedNftData | null {
    const cached = this.nftCache.get(collectionId);
    if (!cached) return null;

    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CoinGeckoService.CACHE_TTL_MS;

    if (isExpired) {
      this.nftCache.delete(collectionId);
      logger.debug(`🗑️ Removed expired cache for ${collectionId}`);
      return null;
    }

    return cached;
  }

  private cacheNftData(collectionId: string, data: NftData): void {
    const now = Date.now();
    const cachedData: CachedNftData = {
      data,
      timestamp: now,
      lastUpdated: new Date(now).toISOString()
    };

    this.nftCache.set(collectionId, cachedData);
    logger.debug(`💾 Cached NFT data for ${collectionId}`, {
      timestamp: cachedData.lastUpdated
    });
  }

  public getCacheTimeRemaining(collectionId: string): number {
    const cached = this.nftCache.get(collectionId);
    if (!cached) return 0;

    const elapsed = Date.now() - cached.timestamp;
    const remaining = Math.max(0, CoinGeckoService.CACHE_TTL_MS - elapsed);
    return Math.ceil(remaining / 1000);
  }

  public getCacheInfo(collectionId: string): { lastUpdated: string; remainingSeconds: number } | null {
    const cached = this.nftCache.get(collectionId);
    if (!cached) return null;

    return {
      lastUpdated: cached.lastUpdated,
      remainingSeconds: this.getCacheTimeRemaining(collectionId)
    };
  }

  public clearCache(collectionId?: string): void {
    if (collectionId) {
      this.nftCache.delete(collectionId);
      logger.debug(`🗑️ Cleared cache for ${collectionId}`);
    } else {
      this.nftCache.clear();
      logger.debug('🗑️ Cleared all NFT cache');
    }
  }
}
