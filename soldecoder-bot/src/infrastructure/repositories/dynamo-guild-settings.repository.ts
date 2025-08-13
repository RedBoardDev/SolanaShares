import type { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

interface DynamoGuildSettingsItem {
  PK: string;        // GUILD#{guildId}
  SK: string;        // SETTINGS
  Type: string;      // guild_settings
  timezone: string;
  positionDisplayEnabled: boolean;
  autoDeleteWarnings: boolean;
  globalChannelId: string;
  forwardTpSl: boolean;
  summaryPreferences: {
    dailySummary: boolean;
    weeklySummary: boolean;
    monthlySummary: boolean;
  };
  positionSizeDefaults?: {
    walletAddress: string | null;
    stopLossPercent: number | null;
  };
  createdAt: number;
}

export class DynamoGuildSettingsRepository implements GuildSettingsRepository {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.tableName = config.aws.tables.config;
  }

  async getByGuildId(guildId: string): Promise<GuildSettingsEntity | null> {
    const cached = this.cacheService.getGuildSettings(guildId);
    if (cached) {
      logger.debug(`Guild settings found in cache for guild ${guildId}`);
      return cached;
    }

    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'SETTINGS',
        },
      });

      if (!result.Item) {
        logger.debug(`Guild settings not found for guild ${guildId}`);
        return null;
      }

      const item = result.Item as DynamoGuildSettingsItem;
      const entity = this.mapToEntity(item, guildId);

      this.cacheService.setGuildSettings(entity);
      logger.debug(`Guild settings loaded from DB and cached for guild ${guildId}`);

      return entity;
    } catch (error) {
      logger.error(`Failed to get guild settings for guild ${guildId}`, error as Error);
      throw error;
    }
  }

  async save(guildSettings: GuildSettingsEntity): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${guildSettings.guildId}`,
          SK: 'SETTINGS',
          Type: 'guild_settings',
          timezone: guildSettings.timezone,
          positionDisplayEnabled: guildSettings.positionDisplayEnabled,
          autoDeleteWarnings: guildSettings.autoDeleteWarnings,
          globalChannelId: guildSettings.globalChannelId,
          forwardTpSl: guildSettings.forwardTpSl,
          summaryPreferences: guildSettings.summaryPreferences,
          positionSizeDefaults: guildSettings.positionSizeDefaults,
          createdAt: guildSettings.createdAt,
        },
      });

      this.cacheService.setGuildSettings(guildSettings);

      logger.debug(`Guild settings saved for guild ${guildSettings.guildId}`);
    } catch (error) {
      logger.error(`Failed to save guild settings for guild ${guildSettings.guildId}`, error as Error);
      throw error;
    }
  }

  async delete(guildId: string): Promise<void> {
    try {
      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'SETTINGS',
        },
      });

      this.cacheService.removeGuildSettings(guildId);

      logger.debug(`Guild settings deleted for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to delete guild settings for guild ${guildId}`, error as Error);
      throw error;
    }
  }

  async exists(guildId: string): Promise<boolean> {
    const cached = this.cacheService.getGuildSettings(guildId);
    if (cached) {
      return true;
    }

    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'SETTINGS',
        },
      });

      return !!result.Item;
    } catch (error) {
      logger.error(`Failed to check if guild settings exist for guild ${guildId}`, error as Error);
      return false;
    }
  }

  async getAllGuilds(): Promise<GuildSettingsEntity[]> {
    try {
      const cachedAll = this.cacheService.getAllGuildSettings();
      if (cachedAll.length > 0) {
        logger.debug(`Returning ${cachedAll.length} guild settings from cache`);
        return cachedAll;
      }

      const result = await this.dynamoService.scan({
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'Type',
        },
        ExpressionAttributeValues: {
          ':type': 'guild_settings',
        },
      });

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      const entities = result.Items.map((item: any) => {
        const guildId = item.PK.replace('GUILD#', '');
        const entity = this.mapToEntity(item, guildId);

        this.cacheService.setGuildSettings(entity);
        return entity;
      });

      logger.debug(`Loaded ${entities.length} guild settings from DB and refreshed cache`);
      return entities;
    } catch (error) {
      logger.error('Failed to get all guilds', error as Error);
      throw error;
    }
  }

  private mapToEntity(item: DynamoGuildSettingsItem, guildId: string): GuildSettingsEntity {
    return GuildSettingsEntity.create({
      guildId,
      timezone: item.timezone,
      positionDisplayEnabled: item.positionDisplayEnabled,
      autoDeleteWarnings: item.autoDeleteWarnings || false,
      globalChannelId: item.globalChannelId || '',
      forwardTpSl: item.forwardTpSl || false,
      summaryPreferences: item.summaryPreferences,
      positionSizeDefaults: item.positionSizeDefaults || { walletAddress: null, stopLossPercent: null },
      createdAt: item.createdAt || Date.now(),
    });
  }
}
