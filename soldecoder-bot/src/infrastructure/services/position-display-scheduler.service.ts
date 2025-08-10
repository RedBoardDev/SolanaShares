import type { Client } from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { UpdateGlobalPositionDisplayUseCase } from '@application/use-cases/update-global-position-display.use-case';
import { logger } from '@helpers/logger';

export class PositionDisplayScheduler {
  private static instance: PositionDisplayScheduler;
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly updateGlobalUC: UpdateGlobalPositionDisplayUseCase;
  private interval: NodeJS.Timeout | null = null;
  private isTicking = false;
  private readonly INTERVAL_MS = 30_000;

  private constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.updateGlobalUC = new UpdateGlobalPositionDisplayUseCase();
  }

  static getInstance(): PositionDisplayScheduler {
    if (!PositionDisplayScheduler.instance) {
      PositionDisplayScheduler.instance = new PositionDisplayScheduler();
    }
    return PositionDisplayScheduler.instance;
  }

  start(client: Client): void {
    if (this.interval) {
      logger.warn('PositionDisplayScheduler already running');
      return;
    }

    this.interval = setInterval(() => this.tick(client), this.INTERVAL_MS);
    setTimeout(() => this.tick(client), 5_000);
    logger.info(`PositionDisplayScheduler started every ${this.INTERVAL_MS / 1000}s`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(client: Client): Promise<void> {
    if (this.isTicking) {
      logger.debug('PositionDisplayScheduler tick skipped (previous tick still running)');
      return;
    }
    this.isTicking = true;

    try {
      const guilds = await this.guildRepo.getAllGuilds();
      const eligible = guilds.filter(g => g.positionDisplayEnabled && !!g.globalChannelId);

      logger.debug('PositionDisplayScheduler tick', {
        totalGuilds: guilds.length,
        eligible: eligible.length,
      });

      for (const g of eligible) {
        try {
          await this.updateGlobalUC.execute(g.guildId, client);
        } catch (error) {
          logger.warn('Failed to update global position display for guild', {
            guildId: g.guildId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('PositionDisplayScheduler tick failed', error as Error);
    } finally {
      this.isTicking = false;
    }
  }
}
