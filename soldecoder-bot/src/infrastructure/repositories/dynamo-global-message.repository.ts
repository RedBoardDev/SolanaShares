import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';

interface DynamoGlobalMessageItem {
  PK: string;        // GUILD#{guildId}
  SK: string;        // GLOBAL_MESSAGE
  Type: string;      // global_position_message
  messageId: string;
  lastUpdated: number;
}

export class DynamoGlobalMessageRepository {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.tableName = config.aws.tables.config;
  }

  async getGlobalMessageId(guildId: string): Promise<string | null> {
    const cached = this.cacheService.getGlobalMessage(guildId);
    if (cached) {
      logger.debug(`Global message ID found in cache for guild ${guildId}`);
      return cached.messageId;
    }

    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: `GUILD#${guildId}`,
          SK: 'GLOBAL_MESSAGE',
        },
      });

      if (!result.Item) {
        logger.debug(`Global message not found for guild ${guildId}`);
        return null;
      }

      const item = result.Item as DynamoGlobalMessageItem;
      const globalMessage: GlobalPositionMessage = {
        guildId,
        messageId: item.messageId,
        lastUpdated: item.lastUpdated,
      };

      this.cacheService.setGlobalMessage(globalMessage);
      logger.debug(`Global message loaded from DB and cached for guild ${guildId}`);

      return item.messageId;
    } catch (error) {
      logger.error(`Failed to get global message for guild ${guildId}`, error as Error);
      throw error;
    }
  }

  async saveGlobalMessage(guildId: string, messageId: string): Promise<void> {
    const lastUpdated = Date.now();

    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `GUILD#${guildId}`,
          SK: 'GLOBAL_MESSAGE',
          Type: 'global_position_message',
          messageId,
          lastUpdated,
        },
      });

      const globalMessage: GlobalPositionMessage = {
        guildId,
        messageId,
        lastUpdated,
      };
      this.cacheService.setGlobalMessage(globalMessage);

      logger.debug(`Global message saved for guild ${guildId}`, { messageId });
    } catch (error) {
      logger.error(`Failed to save global message for guild ${guildId}`, error as Error);
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

      this.cacheService.removeGlobalMessage(guildId);

      logger.debug(`Global message deleted for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to delete global message for guild ${guildId}`, error as Error);
      throw error;
    }
  }

  async getAllGlobalMessages(): Promise<GlobalPositionMessage[]> {
    try {
      const result = await this.dynamoService.scan({
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'Type',
        },
        ExpressionAttributeValues: {
          ':type': 'global_position_message',
        },
      });

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.map((item: any) => ({
        guildId: item.PK.replace('GUILD#', ''),
        messageId: item.messageId,
        lastUpdated: item.lastUpdated,
      }));
    } catch (error) {
      logger.error('Failed to get all global messages', error as Error);
      throw error;
    }
  }
}
