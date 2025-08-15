import type { GlobalStatsRepository } from '@domain/interfaces/global-stats.repository.interface';
import { GlobalStatsEntity } from '@domain/entities/global-stats.entity';
import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

interface DynamoGlobalStatsItem {
  PK: string;           // GLOBAL#STATS
  SK: string;           // GLOBAL#STATS
  Type: string;         // global_stats
  totalInvested: number;
  participantCount: number;
  activeParticipants: number;
  updatedAt: number;
}

export class DynamoGlobalStatsRepository implements GlobalStatsRepository {
  private readonly dynamoService: DynamoService;
  private readonly cacheService: CacheService;
  private readonly tableName: string;

  private readonly PK = 'GLOBAL#STATS';
  private readonly SK = 'GLOBAL#STATS';

  constructor() {
    this.dynamoService = new DynamoService();
    this.cacheService = CacheService.getInstance();
    this.tableName = config.aws.tables.config;
  }

  async getGlobalStats(): Promise<GlobalStatsEntity> {
    const cached = this.cacheService.getGlobalStats();
    if (cached) {
      logger.debug('Global stats found in cache');
      return cached;
    }

    try {
      const result = await this.dynamoService.get({
        TableName: this.tableName,
        Key: {
          PK: this.PK,
          SK: this.SK,
        },
      });

      if (!result.Item) {
        logger.debug('Global stats not found, creating default');
        await this.initializeIfNotExists();
        return GlobalStatsEntity.create();
      }

      const item = result.Item as DynamoGlobalStatsItem;
      const entity = this.mapToEntity(item);

      this.cacheService.setGlobalStats(entity);
      logger.debug('Global stats loaded from DB and cached');

      return entity;
    } catch (error) {
      logger.error('Failed to get global stats', error as Error);
      throw error;
    }
  }

  async updateGlobalStats(stats: GlobalStatsEntity): Promise<void> {
    try {
      await this.dynamoService.update({
        TableName: this.tableName,
        Key: {
          PK: this.PK,
          SK: this.SK,
        },
        UpdateExpression: 'SET #type = :type, totalInvested = :totalInvested, participantCount = :participantCount, activeParticipants = :activeParticipants, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#type': 'Type',
        },
        ExpressionAttributeValues: {
          ':type': 'global_stats',
          ':totalInvested': stats.totalInvested,
          ':participantCount': stats.participantCount,
          ':activeParticipants': stats.activeParticipants,
          ':updatedAt': stats.updatedAt,
        },
      });

      this.cacheService.setGlobalStats(stats);

      logger.debug('Global stats updated successfully');
    } catch (error) {
      logger.error('Failed to update global stats', error as Error);
      throw error;
    }
  }

  async initializeIfNotExists(): Promise<void> {
    try {
      const stats = GlobalStatsEntity.create();

      await this.dynamoService.create({
        TableName: this.tableName,
        Item: {
          PK: this.PK,
          SK: this.SK,
          Type: 'global_stats',
          totalInvested: stats.totalInvested,
          participantCount: stats.participantCount,
          activeParticipants: stats.activeParticipants,
          updatedAt: stats.updatedAt,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      });

      this.cacheService.setGlobalStats(stats);

      logger.info('Global stats initialized');
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        logger.debug('Global stats already exist, skipping initialization');
        return;
      }
      logger.error('Failed to initialize global stats', error as Error);
      throw error;
    }
  }

  async incrementParticipant(investedAmount = 0): Promise<void> {
    const currentStats = await this.getGlobalStats();
    const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
    const updatedStats = currentStats.incrementParticipant(investedAmount, minSolAmount);
    await this.updateGlobalStats(updatedStats);
  }

  async decrementParticipant(investedAmount: number): Promise<void> {
    const currentStats = await this.getGlobalStats();
    const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
    const updatedStats = currentStats.decrementParticipant(investedAmount, minSolAmount);
    await this.updateGlobalStats(updatedStats);
  }

  async updateInvestedAmount(oldAmount: number, newAmount: number): Promise<void> {
    const currentStats = await this.getGlobalStats();
    const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
    const updatedStats = currentStats.updateInvestedAmount(oldAmount, newAmount, minSolAmount);
    await this.updateGlobalStats(updatedStats);
  }

  private mapToEntity(item: DynamoGlobalStatsItem): GlobalStatsEntity {
    return GlobalStatsEntity.restore({
      type: item.Type,
      totalInvested: item.totalInvested,
      participantCount: item.participantCount,
      activeParticipants: item.activeParticipants,
      updatedAt: item.updatedAt,
    });
  }
}
