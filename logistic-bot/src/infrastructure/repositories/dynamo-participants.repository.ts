import type { ParticipantRepository } from '@domain/interfaces/participant.repository.interface';
import { ParticipantEntity, Participant } from '@domain/entities/participant.entity';
import { DynamoGlobalStatsRepository } from '@infrastructure/repositories/dynamo-global-stats.repository';
import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

interface DynamoParticipantItem {
  PK: string;           // USER#{userId}
  SK: string;           // WALLET#{walletAddress}
  Type: string;         // participant
  GSI_PK: string;       // WALLET#{walletAddress}
  GSI_SK: string;       // USER#{userId}
  investedAmount: number;
  createdAt: number;
  updatedAt: number;
}

export class DynamoParticipantRepository implements ParticipantRepository {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly globalStatsRepo: DynamoGlobalStatsRepository;
  private readonly tableName: string;

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.globalStatsRepo = new DynamoGlobalStatsRepository();
    this.tableName = config.aws.tables.config;
  }

  async getAll(): Promise<ParticipantEntity[]> {
    const cached = this.cacheService.getAllParticipants();
    if (cached.length > 0) {
      logger.debug(`Found ${cached.length} participants in cache`);
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
          ':type': 'participant',
        },
      });

      const entities = (result.Items || []).map(item => {
        const dynamoItem = item as DynamoParticipantItem;
        const userId = dynamoItem.PK.replace('USER#', '');
        const walletAddress = dynamoItem.SK.replace('WALLET#', '');
        return this.mapToEntity(dynamoItem, userId, walletAddress);
      });

      entities.forEach(entity => {
        this.cacheService.setParticipant(entity);
      });

      logger.debug(`Loaded ${entities.length} participants from DB`);
      return entities;
    } catch (error) {
      logger.error('Failed to get all participants', error as Error);
      throw error;
    }
  }

  async findByWalletAddress(walletAddress: string): Promise<ParticipantEntity | null> {
    const cached = this.cacheService.getParticipantByWalletAddress(walletAddress);
    if (cached) {
      logger.debug(`Participant found in cache for wallet ${walletAddress}`);
      return cached;
    }

    try {
      const result = await this.dynamoService.query({
        TableName: this.tableName,
        IndexName: 'WalletAddressIndex',
        KeyConditionExpression: 'GSI_PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `WALLET#${walletAddress}`,
        },
      });

      if (!result.Items || result.Items.length === 0) {
        logger.debug(`Participant not found for wallet ${walletAddress}`);
        return null;
      }

      const item = result.Items[0] as DynamoParticipantItem;
      const userId = item.GSI_SK.replace('USER#', '');
      const entity = this.mapToEntity(item, userId, walletAddress);

      this.cacheService.setParticipant(entity);
      logger.debug(`Participant loaded from DB and cached for wallet ${walletAddress}`);

      return entity;
    } catch (error) {
      logger.error(`Failed to get participant for wallet ${walletAddress}`, error as Error);
      throw error;
    }
  }

  async findByDiscordUser(discordUser: string): Promise<ParticipantEntity | null> {
    const cached = this.cacheService.getParticipantByDiscordUser(discordUser);
    if (cached) {
      logger.debug(`Participant found in cache for Discord user ${discordUser}`);
      return cached;
    }

    try {
      const result = await this.dynamoService.query({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${discordUser}`,
          ':sk': 'WALLET#',
        },
      });

      if (!result.Items || result.Items.length === 0) {
        logger.debug(`Participant not found for Discord user ${discordUser}`);
        return null;
      }

      const item = result.Items[0] as DynamoParticipantItem;
      const walletAddress = item.SK.replace('WALLET#', '');
      const entity = this.mapToEntity(item, discordUser, walletAddress);

      this.cacheService.setParticipant(entity);
      logger.debug(`Participant loaded from DB and cached for Discord user ${discordUser}`);

      return entity;
    } catch (error) {
      logger.error(`Failed to get participant for Discord user ${discordUser}`, error as Error);
      throw error;
    }
  }

  async save(participant: ParticipantEntity): Promise<void> {
    try {
      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: `USER#${participant.userId}`,
          SK: `WALLET#${participant.walletAddress}`,
          Type: 'participant',
          GSI_PK: `WALLET#${participant.walletAddress}`,
          GSI_SK: `USER#${participant.userId}`,
          investedAmount: participant.investedAmount,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
        },
      });

      this.cacheService.setParticipant(participant);

      logger.debug(`Participant saved for user ${participant.userId}`);
    } catch (error) {
      logger.error(`Failed to save participant for user ${participant.userId}`, error as Error);
      throw error;
    }
  }

  async update(participant: ParticipantEntity): Promise<void> {
    try {
      const oldParticipant = await this.findByDiscordUser(participant.userId);

      await this.dynamoService.update({
        TableName: this.tableName,
        Key: {
          PK: `USER#${participant.userId}`,
          SK: `WALLET#${participant.walletAddress}`,
        },
        UpdateExpression: 'SET investedAmount = :investedAmount, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':investedAmount': participant.investedAmount,
          ':updatedAt': participant.updatedAt,
        },
      });

      this.cacheService.setParticipant(participant);

      logger.debug(`Participant updated for user ${participant.userId}`);
    } catch (error) {
      logger.error(`Failed to update participant for user ${participant.userId}`, error as Error);
      throw error;
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      const participant = await this.findByDiscordUser(userId);
      if (!participant) {
        logger.debug(`Participant not found for deletion: ${userId}`);
        return;
      }

      await this.dynamoService.delete({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `WALLET#${participant.walletAddress}`,
        },
      });

      this.cacheService.removeParticipant(participant.walletAddress);

      logger.debug(`Participant deleted for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete participant for user ${userId}`, error as Error);
      throw error;
    }
  }

  async getParticipantsWithTransactions(): Promise<ParticipantEntity[]> {
    try {
      const allParticipants = await this.getAll();
      return allParticipants;
    } catch (error) {
      logger.error('Failed to get participants with transactions', error as Error);
      throw error;
    }
  }

  async getActiveParticipantsWithTransactions(): Promise<ParticipantEntity[]> {
    try {
      const allParticipants = await this.getAll();
      return allParticipants.filter(participant => participant.investedAmount > 0);
    } catch (error) {
      logger.error('Failed to get participants with transactions', error as Error);
      throw error;
    }
  }

  async getGlobalStats(): Promise<{ totalInvested: number; participantCount: number; activeParticipants: number }> {
    try {
      const globalStats = await this.globalStatsRepo.getGlobalStats();
      return {
        totalInvested: globalStats.totalInvested,
        participantCount: globalStats.participantCount,
        activeParticipants: globalStats.activeParticipants,
      };
    } catch (error) {
      logger.error('Failed to get global stats', error as Error);
      throw error;
    }
  }

  private mapToEntity(item: DynamoParticipantItem, userId: string, walletAddress: string): ParticipantEntity {
    return ParticipantEntity.restore({
      userId,
      walletAddress,
      investedAmount: item.investedAmount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
}
