import type { Client } from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { PositionUpdateQueueService } from '@infrastructure/services/position-update-queue.service';
import { logger } from '@helpers/logger';

/**
 * Optimized scheduling service for position updates.
 * Uses a queue system to efficiently manage updates across 50+ guilds.
 */
export class PositionDisplayScheduler {
  private static instance: PositionDisplayScheduler;
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly updateQueue: PositionUpdateQueueService;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly INTERVAL_MS = 30_000;
  private readonly INITIAL_DELAY_MS = 5_000;
  /**
   * Batch priorities for guilds based on activity status.
   * ACTIVE: Guilds with recent messages
   * NORMAL: Regular guilds
   * INACTIVE: Inactive guilds
   */
  private readonly BATCH_PRIORITY = {
    ACTIVE: 10,
    NORMAL: 5,
    INACTIVE: 1,
  };

  private constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.updateQueue = PositionUpdateQueueService.getInstance();
  }

  static getInstance(): PositionDisplayScheduler {
    if (!PositionDisplayScheduler.instance) {
      PositionDisplayScheduler.instance = new PositionDisplayScheduler();
    }
    return PositionDisplayScheduler.instance;
  }

  start(client: Client): void {
    if (this.isRunning) {
      logger.warn('PositionDisplayScheduler already running');
      return;
    }

    this.isRunning = true;
    this.updateQueue.initialize(client);

    setTimeout(() => this.tick(), this.INITIAL_DELAY_MS);

    this.interval = setInterval(() => this.tick(), this.INTERVAL_MS);

    logger.info(`PositionDisplayScheduler started (interval: ${this.INTERVAL_MS / 1000}s)`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    this.updateQueue.clear();

    logger.info('PositionDisplayScheduler stopped');
  }

  private async tick(): Promise<void> {
    try {
      const startTime = Date.now();

      const guilds = await this.guildRepo.getAllGuilds();
      const eligible = guilds.filter((g) => g.positionDisplayEnabled && g.globalChannelId && g.guildId);

      if (eligible.length === 0) {
        return;
      }

      const sortedGuilds = this.prioritizeGuilds(eligible);

      for (const { guild, priority } of sortedGuilds) {
        this.updateQueue.enqueue(guild.guildId, priority);
      }

      const stats = this.updateQueue.getStats();
      const duration = Date.now() - startTime;

      logger.info('PositionDisplayScheduler tick completed', {
        totalGuilds: guilds.length,
        eligible: eligible.length,
        queued: sortedGuilds.length,
        queueStats: stats,
        tickDuration: duration,
      });
    } catch (error) {
      logger.error('PositionDisplayScheduler tick failed', error as Error);
    }
  }

  private prioritizeGuilds(
    guilds: Array<{ guildId: string; positionDisplayEnabled: boolean; globalChannelId: string | null }>,
  ): Array<{
    guild: { guildId: string; positionDisplayEnabled: boolean; globalChannelId: string | null };
    priority: number;
  }> {
    return guilds.map((guild) => {
      const priority = this.BATCH_PRIORITY.NORMAL;

      return { guild, priority };
    });
  }

  forceUpdate(guildId: string, priority: number = this.BATCH_PRIORITY.ACTIVE): void {
    if (!this.isRunning) {
      logger.warn('Cannot force update - scheduler not running');
      return;
    }

    this.updateQueue.enqueue(guildId, priority);
    logger.info('Forced update queued', { guildId, priority });
  }

  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    queueStats: ReturnType<PositionUpdateQueueService['getStats']>;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.INTERVAL_MS,
      queueStats: this.updateQueue.getStats(),
    };
  }
}
