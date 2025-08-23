import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { CachedRepositoryBase } from './base/cached-repository.base';
import { logger } from '@helpers/logger';

/**
 * Simplified repository using the cached base class.
 * Eliminates ALL the repetitive cache/database logic!
 */
export class DynamoChannelConfigRepository extends CachedRepositoryBase implements ChannelConfigRepository {
  // Cache key prefixes
  private readonly CHANNEL_PREFIX = 'channel_config';
  private readonly GUILD_CHANNELS_PREFIX = 'guild_channels';

  async getByChannelId(channelId: string): Promise<ChannelConfigEntity | null> {
    const cacheKey = `${this.CHANNEL_PREFIX}:${channelId}`;

    return this.cachedGet(
      cacheKey,
      () => this.databaseService.getChannelConfig(channelId),
      { channelId, operation: 'getByChannelId' }
    );
  }

  async getByGuildId(guildId: string): Promise<ChannelConfigEntity[]> {
    const guildCacheKey = `${this.GUILD_CHANNELS_PREFIX}:${guildId}`;

    // Try to get cached channel IDs list
    const cachedChannelIds = await this.cache.get<string[]>(guildCacheKey);

    if (cachedChannelIds && cachedChannelIds.length > 0) {
      // Try to get all channels from cache
      const configs: ChannelConfigEntity[] = [];
      let allFound = true;

      for (const channelId of cachedChannelIds) {
        const config = await this.cache.get<ChannelConfigEntity>(`${this.CHANNEL_PREFIX}:${channelId}`);
        if (config) {
          configs.push(config);
        } else {
          allFound = false;
          break;
        }
      }

      if (allFound) {
        logger.debug('[SIMPLE_REPO] All guild channels found in cache', { guildId, count: configs.length });
        return configs;
      }
    }

    // Fallback: load from database
    logger.debug('[SIMPLE_REPO] Guild channels cache miss, loading from DB', { guildId });
    const allConfigs = await this.databaseService.getAllChannelConfigs();
    const guildConfigs = allConfigs.filter(config => config.guildId === guildId);

    // Cache everything
    this.cacheMultiple(guildConfigs, config => `${this.CHANNEL_PREFIX}:${config.channelId}`);

    // Cache the guild channels list
    const channelIds = guildConfigs.map(config => config.channelId);
    this.cache.set(guildCacheKey, channelIds, this.defaultTtlMs);

    return guildConfigs;
  }

  async save(channelConfig: ChannelConfigEntity): Promise<void> {
    const cacheKey = `${this.CHANNEL_PREFIX}:${channelConfig.channelId}`;

    await this.cachedSave(
      cacheKey,
      channelConfig,
      (config) => this.databaseService.saveChannelConfig(config),
      { channelId: channelConfig.channelId, guildId: channelConfig.guildId, operation: 'save' }
    );

    // Update guild channels list
    await this.updateCacheList(
      `${this.GUILD_CHANNELS_PREFIX}:${channelConfig.guildId}`,
      channelConfig.channelId,
      'add'
    );
  }

  async delete(channelId: string): Promise<void> {
    // First get the config to know the guildId
    const config = await this.getByChannelId(channelId);
    if (!config) {
      logger.debug('[SIMPLE_REPO] Channel config not found for deletion', { channelId });
      return;
    }

    const cacheKey = `${this.CHANNEL_PREFIX}:${channelId}`;

    await this.cachedDelete(
      cacheKey,
      () => this.databaseService.deleteChannelConfig(channelId, config.guildId),
      { channelId, guildId: config.guildId, operation: 'delete' }
    );

    // Update guild channels list
    await this.updateCacheList(
      `${this.GUILD_CHANNELS_PREFIX}:${config.guildId}`,
      channelId,
      'remove'
    );
  }

  async exists(channelId: string): Promise<boolean> {
    const config = await this.getByChannelId(channelId);
    return config !== null;
  }

  async getAll(): Promise<ChannelConfigEntity[]> {
    logger.debug('[SIMPLE_REPO] Getting all channel configs');

    // Load all from database
    const allConfigs = await this.databaseService.getAllChannelConfigs();

    // Cache everything at once
    this.cacheMultiple(allConfigs, config => `${this.CHANNEL_PREFIX}:${config.channelId}`);

    // Group by guild and cache guild channels lists
    const guildChannelsMap = new Map<string, string[]>();
    for (const config of allConfigs) {
      const existing = guildChannelsMap.get(config.guildId) || [];
      existing.push(config.channelId);
      guildChannelsMap.set(config.guildId, existing);
    }

    // Cache all guild channels lists
    for (const [guildId, channelIds] of guildChannelsMap) {
      this.cache.set(`${this.GUILD_CHANNELS_PREFIX}:${guildId}`, channelIds, this.defaultTtlMs);
    }

    logger.debug('[SIMPLE_REPO] All channel configs loaded and cached', {
      total: allConfigs.length,
      guilds: guildChannelsMap.size
    });

    return allConfigs;
  }
}
