import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

interface DynamoChannelConfigItem {
  PK: string;           // GUILD#{guildId}
  SK: string;           // CHANNEL#{channelId}
  Type: string;         // channel_config
  GSI_PK: string;       // CHANNEL#{channelId}
  GSI_SK: string;       // GUILD#{guildId}
  image: boolean;
  notifyOnClose: boolean;
  pin: boolean;
  tagType: 'USER' | 'ROLE' | 'NONE';
  tagId: string;
  threshold: number;
  createdAt: number;
}

export class DynamoChannelConfigRepository implements ChannelConfigRepository {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.tableName = config.aws.tables.config;
  }

  async getByChannelId(channelId: string): Promise<ChannelConfigEntity | null> {
    const cached = this.cacheService.getChannelConfig(channelId);
    if (cached) {
      logger.debug(`Channel config found in cache for channel ${channelId}`);
      return cached;
    }

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
        logger.debug(`Channel config not found for channel ${channelId}`);
        return null;
      }

      const item = result.Items[0] as DynamoChannelConfigItem;
      const guildId = item.PK.replace('GUILD#', '');
      const entity = this.mapToEntity(item, channelId, guildId);

      this.cacheService.setChannelConfig(entity);
      logger.debug(`Channel config loaded from DB and cached for channel ${channelId}`);

      return entity;
    } catch (error) {
      logger.error(`Failed to get channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }

  async getByGuildId(guildId: string): Promise<ChannelConfigEntity[]> {
    const cached = this.cacheService.getGuildChannels(guildId);
    if (cached.length > 0) {
      logger.debug(`Found ${cached.length} channel configs in cache for guild ${guildId}`);
      return cached;
    }

    try {
      const result = await this.dynamoService.query({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `GUILD#${guildId}`,
          ':sk': 'CHANNEL#',
        },
      });

      const entities = (result.Items || []).map(item => {
        const dynamoItem = item as DynamoChannelConfigItem;
        const channelId = dynamoItem.SK.replace('CHANNEL#', '');
        return this.mapToEntity(dynamoItem, channelId, guildId);
      });

      entities.forEach(entity => {
        this.cacheService.setChannelConfig(entity);
      });

      logger.debug(`Loaded ${entities.length} channel configs from DB for guild ${guildId}`);
      return entities;
    } catch (error) {
      logger.error(`Failed to get channel configs for guild ${guildId}`, error as Error);
      throw error;
    }
  }

  async save(channelConfig: ChannelConfigEntity): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${channelConfig.guildId}`,
          SK: `CHANNEL#${channelConfig.channelId}`,
          Type: 'channel_config',
          GSI_PK: `CHANNEL#${channelConfig.channelId}`,
          GSI_SK: `GUILD#${channelConfig.guildId}`,
          image: channelConfig.image,
          notifyOnClose: channelConfig.notifyOnClose,
          pin: channelConfig.pin,
          tagType: channelConfig.tagType,
          tagId: channelConfig.tagId,
          threshold: channelConfig.threshold,
          createdAt: channelConfig.createdAt,
        },
      });

      this.cacheService.setChannelConfig(channelConfig);

      logger.debug(`Channel config saved for channel ${channelConfig.channelId}`);
    } catch (error) {
      logger.error(`Failed to save channel config for channel ${channelConfig.channelId}`, error as Error);
      throw error;
    }
  }

  async delete(channelId: string): Promise<void> {
    try {
      const config = await this.getByChannelId(channelId);
      if (!config) {
        logger.debug(`Channel config not found for deletion: ${channelId}`);
        return;
      }

      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${config.guildId}`,
          SK: `CHANNEL#${channelId}`,
        },
      });

      this.cacheService.removeChannelConfig(channelId);

      logger.debug(`Channel config deleted for channel ${channelId}`);
    } catch (error) {
      logger.error(`Failed to delete channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }

  async exists(channelId: string): Promise<boolean> {
    const cached = this.cacheService.getChannelConfig(channelId);
    if (cached) {
      return true;
    }

    try {
      const result = await this.dynamoService.query({
        TableName: this.tableName,
        IndexName: 'ChannelIndex',
        KeyConditionExpression: 'GSI_PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelId}`,
        },
        Select: 'COUNT',
      });

      return (result.Count || 0) > 0;
    } catch (error) {
      logger.error(`Failed to check if channel config exists for channel ${channelId}`, error as Error);
      return false;
    }
  }

  async getAll(): Promise<ChannelConfigEntity[]> {
    const cached = this.cacheService.getAllChannelConfigs();
    if (cached.length > 0) {
      logger.debug(`Found ${cached.length} channel configs in cache`);
      return cached;
    }

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

      const entities = (result.Items || []).map(item => {
        const dynamoItem = item as DynamoChannelConfigItem;
        const channelId = dynamoItem.SK.replace('CHANNEL#', '');
        const guildId = dynamoItem.PK.replace('GUILD#', '');
        return this.mapToEntity(dynamoItem, channelId, guildId);
      });

      entities.forEach(entity => {
        this.cacheService.setChannelConfig(entity);
      });

      logger.debug(`Loaded ${entities.length} channel configs from DB`);
      return entities;
    } catch (error) {
      logger.error('Failed to get all channel configs', error as Error);
      throw error;
    }
  }

  private mapToEntity(item: DynamoChannelConfigItem, channelId: string, guildId: string): ChannelConfigEntity {
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
}
