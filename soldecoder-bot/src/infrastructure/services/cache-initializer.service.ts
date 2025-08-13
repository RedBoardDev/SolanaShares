import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

interface DynamoScanItem {
  PK: string;
  SK: string;
  Type: string;
  [key: string]: any;
}

export class CacheInitializerService {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.tableName = config.aws.tables.config;
  }

  async initializeCache(): Promise<void> {
    try {
      const startTime = Date.now();

      const allItems = await this.scanAllItems();

      let channelCount = 0;
      let guildSettingsCount = 0;
      let globalMessageCount = 0;

      for (const item of allItems) {
        if (item.Type === 'channel_config') {
          await this.loadChannelConfig(item);
          channelCount++;
        } else if (item.Type === 'guild_settings') {
          await this.loadGuildSettings(item);
          guildSettingsCount++;
        } else if (item.Type === 'global_position_message') {
          await this.loadGlobalMessage(item);
          globalMessageCount++;
        }
      }

      const duration = Date.now() - startTime;
      const stats = this.cacheService.getStats();

    } catch (error) {
      logger.error('Failed to initialize cache', error as Error);
      throw error;
    }
  }

  private async scanAllItems(): Promise<DynamoScanItem[]> {
    const allItems: DynamoScanItem[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
      const params: any = {
        TableName: this.tableName,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await this.dynamoService.scan(params);

      if (result.Items) {
        allItems.push(...(result.Items as DynamoScanItem[]));
      }

      lastEvaluatedKey = result.LastEvaluatedKey;

      logger.debug(`Scanned ${result.Items?.length || 0} items, total: ${allItems.length}`);

    } while (lastEvaluatedKey);

    logger.debug(`Total items scanned: ${allItems.length}`);
    return allItems;
  }

  private async loadChannelConfig(item: DynamoScanItem): Promise<void> {
    try {
      const channelId = item.SK.replace('CHANNEL#', '');
      const guildId = item.PK.replace('GUILD#', '');

      const channelConfig = ChannelConfigEntity.create({
        channelId,
        guildId,
        image: item.image || false,
        notifyOnClose: item.notifyOnClose || false,
        pin: item.pin || false,
        tagType: item.tagType || 'NONE',
        tagId: item.tagId || '',
        threshold: item.threshold || 0,
        createdAt: item.createdAt || Date.now(),
      });

      this.cacheService.setChannelConfig(channelConfig);

      logger.debug(`Loaded channel config into cache: ${channelId} (guild: ${guildId})`);
    } catch (error) {
      logger.error(`Failed to load channel config from item`, error as Error, { item });
    }
  }

  private async loadGuildSettings(item: DynamoScanItem): Promise<void> {
    try {
      const guildId = item.PK.replace('GUILD#', '');

      const guildSettings = GuildSettingsEntity.create({
        guildId,
        timezone: item.timezone || 'UTC',
        positionDisplayEnabled: item.positionDisplayEnabled ?? true,
        autoDeleteWarnings: item.autoDeleteWarnings ?? false,
        globalChannelId: item.globalChannelId || '',
        forwardTpSl: item.forwardTpSl || false,
        summaryPreferences: item.summaryPreferences || {
          dailySummary: false,
          weeklySummary: false,
          monthlySummary: false,
        },
        positionSizeDefaults: item.positionSizeDefaults || { walletAddress: null, stopLossPercent: null },
        createdAt: item.createdAt || Date.now(),
      });

      this.cacheService.setGuildSettings(guildSettings);

      logger.debug(`Loaded guild settings into cache: ${guildId}`);
    } catch (error) {
      logger.error(`Failed to load guild settings from item`, error as Error, { item });
    }
  }

  private async loadGlobalMessage(item: DynamoScanItem): Promise<void> {
    try {
      const guildId = item.PK.replace('GUILD#', '');

      const globalMessage: GlobalPositionMessage = {
        guildId,
        messageId: item.messageId,
        lastUpdated: item.lastUpdated,
      };

      this.cacheService.setGlobalMessage(globalMessage);

      logger.debug(`Loaded global message into cache: ${guildId}`);
    } catch (error) {
      logger.error(`Failed to load global message from item`, error as Error, { item });
    }
  }

  async refreshCache(): Promise<void> {
    this.cacheService.clear();

    await this.initializeCache();
  }

  getCacheStats(): { channels: number; guilds: number; guildSettings: number } {
    return this.cacheService.getStats();
  }
}
