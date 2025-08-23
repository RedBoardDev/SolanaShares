import { config } from '@infrastructure/config/env';
import DynamoService from '@infrastructure/services/dynamo.service';
import { logger } from '@helpers/logger';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';

/**
 * Internal service used exclusively by CacheService to interact with DynamoDB.
 * Only CacheService should access this service directly.
 */
export class DatabaseService {
  private readonly dynamoService: DynamoService;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.tableName = config.aws.tables.config;
  }

  async getChannelConfig(channelId: string): Promise<ChannelConfigEntity | null> {
    try {
      const result = await this.dynamoService.query({
        TableName: this.tableName,
        IndexName: 'ChannelIndex',
        KeyConditionExpression: 'GSI_PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
        },
      });

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = result.Items[0];
      const guildId = item.PK.replace('GUILD#', '');

      return this.mapToChannelConfigEntity(item, channelId, guildId);
    } catch (error) {
      logger.error(`[DATABASE] Failed to get channel config for ${channelId}`, error as Error);
      throw error;
    }
  }

  async getAllChannelConfigs(): Promise<ChannelConfigEntity[]> {
    try {
      const result = await this.dynamoService.scan({
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'Type',
        },
        ExpressionAttributeValues: {
          ':type': 'channel_config',
        },
      });

      return (result.Items || []).map((item) => {
        const channelId = item.SK.replace('CHANNEL#', '');
        const guildId = item.PK.replace('GUILD#', '');
        return this.mapToChannelConfigEntity(item, channelId, guildId);
      });
    } catch (error) {
      logger.error('[DATABASE] Failed to get all channel configs', error as Error);
      throw error;
    }
  }

  async saveChannelConfig(config: ChannelConfigEntity): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${config.guildId}`,
          SK: `CHANNEL#${config.channelId}`,
          Type: 'channel_config',
          GSI_PK: `CHANNEL#${config.channelId}`,
          GSI_SK: `GUILD#${config.guildId}`,
          image: config.image,
          notifyOnClose: config.notifyOnClose,
          pin: config.pin,
          tagType: config.tagType,
          tagId: config.tagId,
          threshold: config.threshold,
          createdAt: config.createdAt,
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to save channel config for ${config.channelId}`, error as Error);
      throw error;
    }
  }

  async deleteChannelConfig(channelId: string, guildId: string): Promise<void> {
    try {
      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: `CHANNEL#${channelId}`,
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to delete channel config for ${channelId}`, error as Error);
      throw error;
    }
  }

  async getGuildSettings(guildId: string): Promise<GuildSettingsEntity | null> {
    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'SETTINGS',
        },
      });

      if (!result.Item) {
        return null;
      }

      return this.mapToGuildSettingsEntity(result.Item, guildId);
    } catch (error) {
      logger.error(`[DATABASE] Failed to get guild settings for ${guildId}`, error as Error);
      throw error;
    }
  }

  async getAllGuildSettings(): Promise<GuildSettingsEntity[]> {
    try {
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

      return (result.Items || []).map((item) => {
        const guildId = item.PK.replace('GUILD#', '');
        return this.mapToGuildSettingsEntity(item, guildId);
      });
    } catch (error) {
      logger.error('[DATABASE] Failed to get all guild settings', error as Error);
      throw error;
    }
  }

  async saveGuildSettings(settings: GuildSettingsEntity): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${settings.guildId}`,
          SK: 'SETTINGS',
          Type: 'guild_settings',
          positionDisplayEnabled: settings.positionDisplayEnabled,
          globalChannelId: settings.globalChannelId,
          timezone: settings.timezone,
          forwardTpSl: settings.forwardTpSl,
          autoDeleteWarnings: settings.autoDeleteWarnings,
          summaryPreferences: settings.summaryPreferences,
          positionSizeDefaults: settings.positionSizeDefaults,
          createdAt: settings.createdAt,
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to save guild settings for ${settings.guildId}`, error as Error);
      throw error;
    }
  }

  async deleteGuildSettings(guildId: string): Promise<void> {
    try {
      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'SETTINGS',
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to delete guild settings for ${guildId}`, error as Error);
      throw error;
    }
  }

  async getGlobalMessage(guildId: string): Promise<GlobalPositionMessage | null> {
    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'GLOBAL_MESSAGE',
        },
      });

      if (!result.Item) {
        return null;
      }

      return {
        messageId: result.Item.messageId,
        guildId,
        lastUpdated: result.Item.lastUpdated || Date.now(),
      };
    } catch (error) {
      logger.error(`[DATABASE] Failed to get global message for ${guildId}`, error as Error);
      throw error;
    }
  }

  async saveGlobalMessage(guildId: string, messageId: string): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${guildId}`,
          SK: 'GLOBAL_MESSAGE',
          Type: 'global_position_message',
          messageId,
          lastUpdated: Date.now(),
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to save global message for ${guildId}`, error as Error);
      throw error;
    }
  }

  async deleteGlobalMessage(guildId: string): Promise<void> {
    try {
      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'GLOBAL_MESSAGE',
        },
      });
    } catch (error) {
      logger.error(`[DATABASE] Failed to delete global message for ${guildId}`, error as Error);
      throw error;
    }
  }

  // Helper methods
  private mapToChannelConfigEntity(item: Record<string, any>, channelId: string, guildId: string): ChannelConfigEntity {
    return ChannelConfigEntity.create({
      channelId,
      guildId,
      image: item.image,
      notifyOnClose: item.notifyOnClose,
      pin: item.pin,
      tagType: item.tagType,
      tagId: item.tagId,
      threshold: item.threshold,
      createdAt: item.createdAt || Date.now(),
    });
  }

  private mapToGuildSettingsEntity(item: Record<string, any>, guildId: string): GuildSettingsEntity {
    return GuildSettingsEntity.create({
      guildId,
      positionDisplayEnabled: item.positionDisplayEnabled ?? true,
      globalChannelId: item.globalChannelId || null,
      timezone: item.timezone || 'UTC',
      forwardTpSl: item.forwardTpSl ?? true,
      autoDeleteWarnings: item.autoDeleteWarnings ?? false,
      summaryPreferences: item.summaryPreferences || {
        dailySummary: false,
        weeklySummary: false,
        monthlySummary: false,
      },
      positionSizeDefaults: item.positionSizeDefaults || { walletAddress: null, stopLossPercent: null },
      createdAt: item.createdAt || Date.now(),
    });
  }
}
