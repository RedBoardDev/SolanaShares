import DynamoService from '@infrastructure/services/dynamo.service';
import { CacheService } from '@infrastructure/services/cache.service';
import { ParticipantEntity } from '@domain/entities/participant.entity';
import { GlobalStatsEntity } from '@domain/entities/global-stats.entity';
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
    logger.info('Starting cache initialization...');

    try {
      const startTime = Date.now();

      const allItems = await this.scanAllItems();

      let participantCount = 0;
      let globalStatsCount = 0;

      for (const item of allItems) {
        logger.debug(`Processing item: PK=${item.PK}, SK=${item.SK}, Type=${item.Type}`);

        if (item.Type === 'participant') {
          await this.loadParticipant(item);
          participantCount++;
        } else if (item.Type === 'global_stats' || (item.PK === 'GLOBAL#STATS' && item.SK === 'GLOBAL#STATS')) {
          await this.loadGlobalStats(item);
          globalStatsCount++;
        } else {
          logger.debug(`Unknown item type: ${item.Type} for PK=${item.PK}, SK=${item.SK} - skipping`);
        }
      }

      if (globalStatsCount === 0) {
        await this.initializeDefaultGlobalStats();
        globalStatsCount = 1;
      }

      const duration = Date.now() - startTime;
      const stats = this.cacheService.getStats();

      logger.info(`Cache initialization completed in ${duration}ms - participants: ${participantCount}, global stats: ${globalStatsCount}`, {
        participantsLoaded: participantCount,
        globalStatsLoaded: globalStatsCount,
        cacheStats: stats,
      });

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

  private async loadParticipant(item: DynamoScanItem): Promise<void> {
    try {
      const userId = item.PK.replace('USER#', '');
      const walletAddress = item.SK.replace('WALLET#', '');

      const participant = ParticipantEntity.restore({
        userId,
        walletAddress,
        investedAmount: item.investedAmount || 0,
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || Date.now()
      });

      this.cacheService.setParticipant(participant);

      logger.debug(`Loaded participant into cache: ${userId} (wallet: ${walletAddress}) with ${participant.investedAmount} SOL`);
    } catch (error) {
      logger.error(`Failed to load participant from item`, error as Error, { item });
    }
  }

  private async loadGlobalStats(item: DynamoScanItem): Promise<void> {
    try {
      logger.debug(`Loading global stats from DB: totalInvested=${item.totalInvested}, participantCount=${item.participantCount}, activeParticipants=${item.activeParticipants}`);

      const globalStats = GlobalStatsEntity.restore({
        type: item.Type || 'global_stats',
        totalInvested: item.totalInvested || 0,
        participantCount: item.participantCount || 0,
        activeParticipants: item.activeParticipants || 0,
        updatedAt: item.updatedAt || Date.now(),
      });

      this.cacheService.setGlobalStats(globalStats);

      logger.debug(`✅ Loaded global stats into cache: totalInvested=${globalStats.totalInvested}, participantCount=${globalStats.participantCount}, activeParticipants=${globalStats.activeParticipants}`);
    } catch (error) {
      logger.error(`Failed to load global stats from item`, error as Error, { item });
    }
  }

  private async initializeDefaultGlobalStats(): Promise<void> {
    try {
      const defaultGlobalStats = GlobalStatsEntity.create();
      this.cacheService.setGlobalStats(defaultGlobalStats);
      logger.debug('Initialized clean global stats in cache with all values at 0');
    } catch (error) {
      logger.error('Failed to initialize default global stats', error as Error);
      throw error;
    }
  }

  async refreshCache(): Promise<void> {
    logger.info('Refreshing cache...');

    this.cacheService.clear();

    await this.initializeCache();
  }

  getCacheStats(): { participants: number; globalStats: boolean } {
    return this.cacheService.getStats();
  }
}
