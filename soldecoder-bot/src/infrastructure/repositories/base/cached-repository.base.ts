import type { IGenericCacheService } from '@domain/interfaces/generic-cache.service.interface';
import type { ICachedRepositoryBase } from '@domain/interfaces/cached-repository.interface';
import { GenericCacheServiceImpl } from '@infrastructure/services/generic-cache.service';
import { DatabaseService } from '@infrastructure/services/database.service';
import { logger } from '@helpers/logger';

/** Base class for repositories that automatically handles cache/database operations - eliminates repetitive get cache → get database → save cache patterns */
export abstract class CachedRepositoryBase implements ICachedRepositoryBase {
  public readonly cache: IGenericCacheService;
  public readonly databaseService: DatabaseService;
  public readonly defaultTtlMs = 30 * 1 * 1000; // 30 minutes

  constructor() {
    this.cache = GenericCacheServiceImpl.getInstance();
    this.databaseService = new DatabaseService();
  }

  /**
   * Generic cached get operation.
   * Tries cache first, falls back to database, then caches the result.
   */
  async cachedGet<T>(
    cacheKey: string,
    databaseFetcher: () => Promise<T | null>,
    logContext: Record<string, unknown> = {},
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) {
      logger.debug('[CACHED_REPO] Found in cache', { cacheKey, ...logContext });
      return cached;
    }

    // Not in cache, try database
    logger.debug('[CACHED_REPO] Cache miss, loading from DB', { cacheKey, ...logContext });
    const result = await databaseFetcher();

    if (result) {
      // Cache the result
      this.cache.set(cacheKey, result, this.defaultTtlMs);
      logger.debug('[CACHED_REPO] Loaded from DB and cached', { cacheKey, ...logContext });
    }

    return result;
  }

  /**
   * Generic cached save operation.
   * Saves to database first, then updates cache.
   */
  async cachedSave<T>(
    cacheKey: string,
    entity: T,
    databaseSaver: (entity: T) => Promise<void>,
    logContext: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      // Save to database first
      await databaseSaver(entity);

      // Then update cache
      this.cache.set(cacheKey, entity, this.defaultTtlMs);

      logger.debug('[CACHED_REPO] Saved to DB and cache', { cacheKey, ...logContext });
    } catch (error) {
      logger.error('[CACHED_REPO] Failed to save', error as Error, { cacheKey, ...logContext });
      throw error;
    }
  }

  /**
   * Generic cached delete operation.
   * Deletes from database first, then removes from cache.
   */
  async cachedDelete(
    cacheKey: string,
    databaseDeleter: () => Promise<void>,
    logContext: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      // Delete from database first
      await databaseDeleter();

      // Then remove from cache
      this.cache.delete(cacheKey);

      logger.debug('[CACHED_REPO] Deleted from DB and cache', { cacheKey, ...logContext });
    } catch (error) {
      logger.error('[CACHED_REPO] Failed to delete', error as Error, { cacheKey, ...logContext });
      throw error;
    }
  }

  /**
   * Generic batch cache operation.
   * Useful for caching multiple items at once (like getAll operations).
   */
  cacheMultiple<T>(items: T[], keyExtractor: (item: T) => string, logContext: Record<string, unknown> = {}): void {
    for (const item of items) {
      const cacheKey = keyExtractor(item);
      this.cache.set(cacheKey, item, this.defaultTtlMs);
    }

    logger.debug('[CACHED_REPO] Cached multiple items', {
      count: items.length,
      ...logContext,
    });
  }

  /**
   * Updates a cache list (like guild channels list).
   */
  async updateCacheList(listCacheKey: string, itemToAddOrRemove: string, operation: 'add' | 'remove'): Promise<void> {
    const currentList = (await this.cache.get<string[]>(listCacheKey)) || [];

    if (operation === 'add') {
      if (!currentList.includes(itemToAddOrRemove)) {
        currentList.push(itemToAddOrRemove);
        this.cache.set(listCacheKey, currentList, this.defaultTtlMs);
      }
    } else if (operation === 'remove') {
      const index = currentList.indexOf(itemToAddOrRemove);
      if (index > -1) {
        currentList.splice(index, 1);
        if (currentList.length === 0) {
          this.cache.delete(listCacheKey);
        } else {
          this.cache.set(listCacheKey, currentList, this.defaultTtlMs);
        }
      }
    }
  }
}
