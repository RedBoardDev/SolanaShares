import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';
import { DatabaseService } from '@infrastructure/services/database.service';
import { logger } from '@helpers/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isRefreshing?: boolean;
}

/**
 * Centralized cache service - SINGLE point of access to the database.
 *
 * Responsibilities:
 * - Manage all in-memory data
 * - Automatically refresh expired data
 * - Synchronize with DynamoDB for all operations
 * - Never return undefined/null unless the data truly does not exist
 */
export class CacheService {
  private static instance: CacheService;
  private readonly TTL_MS = 30 * 1 * 1000; // 30 minutes TTL
  private readonly databaseService: DatabaseService;

  // Main caches
  private channelCache = new Map<string, CacheEntry<ChannelConfigEntity>>();
  private guildChannelsCache = new Map<string, string[]>();
  private guildSettingsCache = new Map<string, CacheEntry<GuildSettingsEntity>>();
  private globalMessageCache = new Map<string, CacheEntry<GlobalPositionMessage>>();

  private constructor() {
    this.databaseService = new DatabaseService();
    logger.info(`[CACHE] Cache service initialized (TTL: ${this.TTL_MS / 1000}s)`);
  }

  /**
   * Get the singleton instance of the CacheService.
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // ============= CHANNEL CONFIG OPERATIONS =============

  /**
   * Retrieves a channel configuration.
   * If expired or missing, refreshes from the database.
   * @param channelId The channel ID
   * @returns The ChannelConfigEntity or null if not found
   */
  async getChannelConfig(channelId: string): Promise<ChannelConfigEntity | null> {
    const cached = this.channelCache.get(channelId);

    // If not in cache, load from DB
    if (!cached) {
      logger.debug('[CACHE] Channel config not in cache, loading from DB', { channelId });

      const fresh = await this.databaseService.getChannelConfig(channelId);
      if (fresh) {
        this.setChannelConfigInternal(fresh);
        return fresh;
      }
      return null;
    }

    // If expired and not already refreshing
    if (this.isExpired(cached.timestamp) && !cached.isRefreshing) {
      logger.debug('[CACHE] Channel config expired, refreshing', {
        channelId,
        age: Date.now() - cached.timestamp,
        ttl: this.TTL_MS,
      });

      // Mark as refreshing
      cached.isRefreshing = true;

      try {
        const fresh = await this.databaseService.getChannelConfig(channelId);
        if (fresh) {
          this.setChannelConfigInternal(fresh);
          return fresh;
        } else {
          // Data no longer exists in DB, remove from cache
          this.removeChannelConfigInternal(channelId);
          return null;
        }
      } catch (error) {
        logger.error('[CACHE] Failed to refresh channel config', error as Error);
        cached.isRefreshing = false;
        // On error, return cached data even if expired
        return cached.data;
      }
    }

    return cached.data;
  }

  /**
   * Saves a channel configuration (DB + Cache).
   * @param config The ChannelConfigEntity to save
   */
  async saveChannelConfig(config: ChannelConfigEntity): Promise<void> {
    try {
      // Save to DB first
      await this.databaseService.saveChannelConfig(config);

      // Then update the cache
      this.setChannelConfigInternal(config);

      logger.debug('[CACHE] Channel config saved to DB and cache', {
        channelId: config.channelId,
        guildId: config.guildId,
      });
    } catch (error) {
      logger.error('[CACHE] Failed to save channel config', error as Error);
      throw error;
    }
  }

  /**
   * Deletes a channel configuration (DB + Cache).
   * @param channelId The channel ID to delete
   */
  async deleteChannelConfig(channelId: string): Promise<void> {
    try {
      // Retrieve first to get the guildId
      const config = await this.getChannelConfig(channelId);
      if (!config) {
        logger.debug('[CACHE] Channel config not found for deletion', { channelId });
        return;
      }

      // Delete from DB
      await this.databaseService.deleteChannelConfig(channelId, config.guildId);

      // Then from cache
      this.removeChannelConfigInternal(channelId);

      logger.debug('[CACHE] Channel config deleted from DB and cache', {
        channelId,
        guildId: config.guildId,
      });
    } catch (error) {
      logger.error('[CACHE] Failed to delete channel config', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves all channel configs for a guild.
   * @param guildId The guild ID
   * @returns Array of ChannelConfigEntity
   */
  async getGuildChannels(guildId: string): Promise<ChannelConfigEntity[]> {
    const channelIds = this.guildChannelsCache.get(guildId);

    // If we have IDs in cache, check each channel
    if (channelIds && channelIds.length > 0) {
      const configs: ChannelConfigEntity[] = [];
      let needRefresh = false;

      for (const channelId of channelIds) {
        const cached = this.channelCache.get(channelId);
        if (cached && !this.isExpired(cached.timestamp)) {
          configs.push(cached.data);
        } else {
          needRefresh = true;
          break;
        }
      }

      // If all channels are valid, return them
      if (!needRefresh) {
        return configs;
      }
    }

    // Otherwise, refresh from DB
    logger.debug('[CACHE] Guild channels cache miss or expired, loading from DB', { guildId });

    try {
      const fresh = await this.databaseService.getAllChannelConfigs();
      const guildConfigs = fresh.filter((c) => c.guildId === guildId);

      // Update the cache
      guildConfigs.forEach((config) => this.setChannelConfigInternal(config));

      return guildConfigs;
    } catch (error) {
      logger.error('[CACHE] Failed to load guild channels', error as Error);
      return [];
    }
  }

  // ============= GUILD SETTINGS OPERATIONS =============

  /**
   * Retrieves the settings for a guild.
   * @param guildId The guild ID
   * @returns The GuildSettingsEntity or null if not found
   */
  async getGuildSettings(guildId: string): Promise<GuildSettingsEntity | null> {
    const cached = this.guildSettingsCache.get(guildId);

    // If not in cache, load from DB
    if (!cached) {
      logger.debug('[CACHE] Guild settings not in cache, loading from DB', { guildId });

      const fresh = await this.databaseService.getGuildSettings(guildId);
      if (fresh) {
        this.setGuildSettingsInternal(fresh);
        return fresh;
      }
      return null;
    }

    // If expired and not already refreshing
    if (this.isExpired(cached.timestamp) && !cached.isRefreshing) {
      logger.debug('[CACHE] Guild settings expired, refreshing', {
        guildId,
        age: Date.now() - cached.timestamp,
      });

      cached.isRefreshing = true;

      try {
        const fresh = await this.databaseService.getGuildSettings(guildId);
        if (fresh) {
          this.setGuildSettingsInternal(fresh);
          return fresh;
        } else {
          // Data no longer exists in DB
          this.guildSettingsCache.delete(guildId);
          return null;
        }
      } catch (error) {
        logger.error('[CACHE] Failed to refresh guild settings', error as Error);
        cached.isRefreshing = false;
        return cached.data;
      }
    }

    return cached.data;
  }

  /**
   * Saves the settings for a guild (DB + Cache).
   * @param settings The GuildSettingsEntity to save
   */
  async saveGuildSettings(settings: GuildSettingsEntity): Promise<void> {
    try {
      await this.databaseService.saveGuildSettings(settings);
      this.setGuildSettingsInternal(settings);

      logger.debug('[CACHE] Guild settings saved to DB and cache', {
        guildId: settings.guildId,
      });
    } catch (error) {
      logger.error('[CACHE] Failed to save guild settings', error as Error);
      throw error;
    }
  }

  /**
   * Deletes the settings for a guild (DB + Cache).
   * @param guildId The guild ID to delete
   */
  async deleteGuildSettings(guildId: string): Promise<void> {
    try {
      await this.databaseService.deleteGuildSettings(guildId);
      this.guildSettingsCache.delete(guildId);

      logger.debug('[CACHE] Guild settings deleted from DB and cache', { guildId });
    } catch (error) {
      logger.error('[CACHE] Failed to delete guild settings', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves all guild settings.
   * @returns Array of GuildSettingsEntity
   */
  async getAllGuildSettings(): Promise<GuildSettingsEntity[]> {
    try {
      const fresh = await this.databaseService.getAllGuildSettings();

      // Update the cache
      fresh.forEach((settings) => this.setGuildSettingsInternal(settings));

      return fresh;
    } catch (error) {
      logger.error('[CACHE] Failed to get all guild settings', error as Error);

      // On error, return what we have in cache
      const cached: GuildSettingsEntity[] = [];
      for (const [_, entry] of this.guildSettingsCache) {
        cached.push(entry.data);
      }
      return cached;
    }
  }

  // ============= GLOBAL MESSAGE OPERATIONS =============

  /**
   * Retrieves the global message for a guild.
   * @param guildId The guild ID
   * @returns The GlobalPositionMessage or null if not found
   */
  async getGlobalMessage(guildId: string): Promise<GlobalPositionMessage | null> {
    const cached = this.globalMessageCache.get(guildId);

    if (!cached || this.isExpired(cached.timestamp)) {
      logger.debug('[CACHE] Global message not in cache or expired, loading from DB', { guildId });

      const fresh = await this.databaseService.getGlobalMessage(guildId);
      if (fresh) {
        this.setGlobalMessageInternal(fresh);
        return fresh;
      }
      return null;
    }

    return cached.data;
  }

  /**
   * Saves a global message (DB + Cache).
   * @param guildId The guild ID
   * @param messageId The message ID
   */
  async saveGlobalMessage(guildId: string, messageId: string): Promise<void> {
    try {
      await this.databaseService.saveGlobalMessage(guildId, messageId);

      const globalMessage: GlobalPositionMessage = { messageId, guildId, lastUpdated: Date.now() };
      this.setGlobalMessageInternal(globalMessage);

      logger.debug('[CACHE] Global message saved to DB and cache', { guildId, messageId });
    } catch (error) {
      logger.error('[CACHE] Failed to save global message', error as Error);
      throw error;
    }
  }

  /**
   * Deletes a global message (DB + Cache).
   * @param guildId The guild ID to delete
   */
  async deleteGlobalMessage(guildId: string): Promise<void> {
    try {
      await this.databaseService.deleteGlobalMessage(guildId);
      this.globalMessageCache.delete(guildId);

      logger.debug('[CACHE] Global message deleted from DB and cache', { guildId });
    } catch (error) {
      logger.error('[CACHE] Failed to delete global message', error as Error);
      throw error;
    }
  }

  // ============= CACHE INITIALIZATION =============

  /**
   * Initializes the cache at startup by loading all data.
   */
  async initialize(): Promise<void> {
    logger.info('[CACHE] Starting cache initialization...');
    const startTime = Date.now();

    try {
      // Load all channel configurations
      const allChannelConfigs = await this.databaseService.getAllChannelConfigs();
      allChannelConfigs.forEach((config) => this.setChannelConfigInternal(config));

      // Load all guild settings
      const allGuildSettings = await this.databaseService.getAllGuildSettings();
      allGuildSettings.forEach((settings) => this.setGuildSettingsInternal(settings));

      const duration = Date.now() - startTime;
      logger.info('[CACHE] Cache initialization completed', {
        duration,
        channelConfigs: allChannelConfigs.length,
        guildSettings: allGuildSettings.length,
      });
    } catch (error) {
      logger.error('[CACHE] Failed to initialize cache', error as Error);
      throw error;
    }
  }

  // ============= STATISTICS & DEBUG =============

  /**
   * Returns cache statistics.
   */
  getStats() {
    return {
      channels: this.channelCache.size,
      guilds: this.guildChannelsCache.size,
      guildSettings: this.guildSettingsCache.size,
    };
  }

  /**
   * Returns all channel configurations currently in cache.
   */
  getAllChannelConfigs(): ChannelConfigEntity[] {
    const configs: ChannelConfigEntity[] = [];
    for (const [_, entry] of this.channelCache) {
      configs.push(entry.data);
    }
    return configs;
  }

  // ============= PRIVATE HELPER METHODS =============

  /**
   * Checks if a timestamp is expired based on the TTL.
   * @param timestamp The timestamp to check
   * @returns True if expired, false otherwise
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.TTL_MS;
  }

  /**
   * Internal method to set a channel config in the cache.
   * @param config The ChannelConfigEntity to cache
   */
  private setChannelConfigInternal(config: ChannelConfigEntity): void {
    const existingEntry = this.channelCache.get(config.channelId);
    const wasAlreadyInCache = !!existingEntry;

    this.channelCache.set(config.channelId, {
      data: config,
      timestamp: Date.now(),
      isRefreshing: false,
    });

    // Update the cache of channels per guild
    const guildChannels = this.guildChannelsCache.get(config.guildId) || [];
    if (!guildChannels.includes(config.channelId)) {
      guildChannels.push(config.channelId);
      this.guildChannelsCache.set(config.guildId, guildChannels);
    }

    logger.debug('[CACHE] Channel config saved to cache', {
      channelId: config.channelId,
      guildId: config.guildId,
      timestamp: Date.now(),
      wasAlreadyInCache,
      guildChannelCount: guildChannels.length,
      operation: 'set',
    });
  }

  /**
   * Internal method to remove a channel config from the cache.
   * @param channelId The channel ID to remove
   */
  private removeChannelConfigInternal(channelId: string): void {
    const config = this.channelCache.get(channelId);
    if (!config) return;

    this.channelCache.delete(channelId);

    // Update the cache of channels per guild
    const guildChannels = this.guildChannelsCache.get(config.data.guildId);
    if (guildChannels) {
      const index = guildChannels.indexOf(channelId);
      if (index > -1) {
        guildChannels.splice(index, 1);
        if (guildChannels.length === 0) {
          this.guildChannelsCache.delete(config.data.guildId);
        } else {
          this.guildChannelsCache.set(config.data.guildId, guildChannels);
        }
      }
    }
  }

  /**
   * Internal method to set guild settings in the cache.
   * @param settings The GuildSettingsEntity to cache
   */
  private setGuildSettingsInternal(settings: GuildSettingsEntity): void {
    this.guildSettingsCache.set(settings.guildId, {
      data: settings,
      timestamp: Date.now(),
      isRefreshing: false,
    });

    logger.debug('[CACHE] Guild settings saved to cache', {
      guildId: settings.guildId,
      timestamp: Date.now(),
      positionDisplayEnabled: settings.positionDisplayEnabled,
      globalChannelId: settings.globalChannelId,
      operation: 'set',
    });
  }

  /**
   * Internal method to set a global message in the cache.
   * @param message The GlobalPositionMessage to cache
   */
  private setGlobalMessageInternal(message: GlobalPositionMessage): void {
    this.globalMessageCache.set(message.guildId, {
      data: message,
      timestamp: Date.now(),
    });

    logger.debug('[CACHE] Global message saved to cache', {
      guildId: message.guildId,
      messageId: message.messageId,
    });
  }
}
