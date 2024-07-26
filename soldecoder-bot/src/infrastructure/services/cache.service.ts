import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { GlobalPositionMessage } from '@schemas/position-status.schema';
import { logger } from '@helpers/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheService {
  private static instance: CacheService;
  private readonly TTL_MS = 30 * 60 * 1000;

  private channelCache = new Map<string, CacheEntry<ChannelConfigEntity>>();

  private guildChannelsCache = new Map<string, string[]>();

  private guildSettingsCache = new Map<string, CacheEntry<GuildSettingsEntity>>();

  private globalMessageCache = new Map<string, CacheEntry<GlobalPositionMessage>>();

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  getChannelConfig(channelId: string): ChannelConfigEntity | null {
    const entry = this.channelCache.get(channelId);
    if (!entry) return null;

    if (this.isExpired(entry.timestamp)) {
      this.channelCache.delete(channelId);
      this.removeChannelFromGuildCache(channelId);
      return null;
    }

    return entry.data;
  }

  setChannelConfig(channelConfig: ChannelConfigEntity): void {
    this.channelCache.set(channelConfig.channelId, {
      data: channelConfig,
      timestamp: Date.now(),
    });

    if (!this.guildChannelsCache.has(channelConfig.guildId)) {
      this.guildChannelsCache.set(channelConfig.guildId, []);
    }
    const guildChannels = this.guildChannelsCache.get(channelConfig.guildId)!;
    if (!guildChannels.includes(channelConfig.channelId)) {
      guildChannels.push(channelConfig.channelId);
    }
  }

  removeChannelConfig(channelId: string): void {
    const entry = this.channelCache.get(channelId);
    if (entry) {
      this.channelCache.delete(channelId);
      this.removeChannelFromGuildCache(channelId, entry.data.guildId);
    }
  }

  getGuildChannels(guildId: string): ChannelConfigEntity[] {
    const channelIds = this.guildChannelsCache.get(guildId) || [];
    const configs: ChannelConfigEntity[] = [];

    for (const channelId of channelIds) {
      const config = this.getChannelConfig(channelId);
      if (config) {
        configs.push(config);
      }
    }

    return configs;
  }

  getGuildSettings(guildId: string): GuildSettingsEntity | null {
    const entry = this.guildSettingsCache.get(guildId);
    if (!entry) return null;

    if (this.isExpired(entry.timestamp)) {
      this.guildSettingsCache.delete(guildId);
      return null;
    }

    return entry.data;
  }

  setGuildSettings(guildSettings: GuildSettingsEntity): void {
    this.guildSettingsCache.set(guildSettings.guildId, {
      data: guildSettings,
      timestamp: Date.now(),
    });
  }

  removeGuildSettings(guildId: string): void {
    this.guildSettingsCache.delete(guildId);
  }

  getAllGuildSettings(): GuildSettingsEntity[] {
    const settings: GuildSettingsEntity[] = [];
    for (const [guildId, entry] of this.guildSettingsCache) {
      if (this.isExpired(entry.timestamp)) {
        this.guildSettingsCache.delete(guildId);
        continue;
      }
      settings.push(entry.data);
    }
    return settings;
  }

  getGlobalMessage(guildId: string): GlobalPositionMessage | null {
    const entry = this.globalMessageCache.get(guildId);
    if (!entry || this.isExpired(entry.timestamp)) {
      this.globalMessageCache.delete(guildId);
      return null;
    }
    return entry.data;
  }

  setGlobalMessage(globalMessage: GlobalPositionMessage): void {
    this.globalMessageCache.set(globalMessage.guildId, {
      data: globalMessage,
      timestamp: Date.now(),
    });
  }

  removeGlobalMessage(guildId: string): void {
    this.globalMessageCache.delete(guildId);
  }

  getAllChannelConfigs(): ChannelConfigEntity[] {
    const configs: ChannelConfigEntity[] = [];

    for (const [channelId, entry] of this.channelCache) {
      if (this.isExpired(entry.timestamp)) {
        this.channelCache.delete(channelId);
        this.removeChannelFromGuildCache(channelId);
      } else {
        configs.push(entry.data);
      }
    }

    return configs;
  }

  clear(): void {
    this.channelCache.clear();
    this.guildChannelsCache.clear();
    this.guildSettingsCache.clear();
  }

  getStats(): { channels: number; guilds: number; guildSettings: number } {
    return {
      channels: this.channelCache.size,
      guilds: this.guildChannelsCache.size,
      guildSettings: this.guildSettingsCache.size,
    };
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.TTL_MS;
  }

  private removeChannelFromGuildCache(channelId: string, guildId?: string): void {
    if (guildId) {
      const guildChannels = this.guildChannelsCache.get(guildId);
      if (guildChannels) {
        const index = guildChannels.indexOf(channelId);
        if (index > -1) {
          guildChannels.splice(index, 1);
          if (guildChannels.length === 0) {
            this.guildChannelsCache.delete(guildId);
          }
        }
      }
    } else {
      for (const [gId, channels] of this.guildChannelsCache) {
        const index = channels.indexOf(channelId);
        if (index > -1) {
          channels.splice(index, 1);
          if (channels.length === 0) {
            this.guildChannelsCache.delete(gId);
          }
          break;
        }
      }
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, this.TTL_MS / 2);
  }

  private cleanup(): void {
    let cleanedChannels = 0;
    let cleanedGuilds = 0;


    for (const [channelId, entry] of this.channelCache) {
      if (this.isExpired(entry.timestamp)) {
        try {
          this.channelCache.delete(channelId);
          this.removeChannelFromGuildCache(channelId);
        } catch (error) {
          logger.error(`Error cleaning up channel ${channelId}`, error as Error);
        }
        cleanedChannels++;
      }
    }

    for (const [guildId, entry] of this.guildSettingsCache) {
      if (this.isExpired(entry.timestamp)) {
        try {
          this.guildSettingsCache.delete(guildId);
        } catch (error) {
          logger.error(`Error cleaning up guild settings ${guildId}`, error as Error);
        }
        cleanedGuilds++;
      }
    }

    let cleanedGlobalMessages = 0;
    for (const [guildId, entry] of this.globalMessageCache) {
      if (this.isExpired(entry.timestamp)) {
        try {
          this.globalMessageCache.delete(guildId);
        } catch (error) {
          logger.error(`Error cleaning up global message ${guildId}`, error as Error);
        }
        cleanedGlobalMessages++;
      }
    }

    if (cleanedChannels > 0 || cleanedGuilds > 0 || cleanedGlobalMessages > 0) {
      logger.debug(`Cache cleanup: removed ${cleanedChannels} channels, ${cleanedGuilds} guild settings, ${cleanedGlobalMessages} global messages`);
    }
  }
}
