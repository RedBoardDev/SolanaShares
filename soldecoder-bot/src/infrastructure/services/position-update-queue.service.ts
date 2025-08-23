import type { Client } from 'discord.js';
import { logger } from '@helpers/logger';
import { UpdateGlobalPositionDisplayUseCase } from '@application/use-cases/update-global-position-display.use-case';

interface QueueItem {
  guildId: string;
  priority: number;
  addedAt: number;
  retries: number;
}

/**
 * Queue service for controlled processing of position updates.
 * Allows sequential or batched processing of guilds to manage update flow.
 */
export class PositionUpdateQueueService {
  private static instance: PositionUpdateQueueService;
  private readonly updateUseCase: UpdateGlobalPositionDisplayUseCase;

  private readonly MAX_CONCURRENT = 3;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 5000;
  private readonly BATCH_DELAY_MS = 200;

  private queue: QueueItem[] = [];
  private processing = new Set<string>();
  private isProcessing = false;
  private client: Client | null = null;

  private stats = {
    processed: 0,
    failed: 0,
    retried: 0,
    avgProcessingTime: 0,
    lastProcessingTimes: [] as number[],
  };

  private constructor() {
    this.updateUseCase = new UpdateGlobalPositionDisplayUseCase();
  }

  static getInstance(): PositionUpdateQueueService {
    if (!PositionUpdateQueueService.instance) {
      PositionUpdateQueueService.instance = new PositionUpdateQueueService();
    }
    return PositionUpdateQueueService.instance;
  }

  initialize(client: Client): void {
    this.client = client;
  }

  enqueue(guildId: string, priority = 0): void {
    if (this.isInQueue(guildId) || this.processing.has(guildId)) {
      logger.debug('Guild already in queue or processing', { guildId });
      return;
    }

    this.queue.push({
      guildId,
      priority,
      addedAt: Date.now(),
      retries: 0,
    });

    this.queue.sort((a, b) => b.priority - a.priority);

    logger.debug('Guild added to update queue', {
      guildId,
      priority,
      queueLength: this.queue.length,
      processing: this.processing.size,
    });

    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  enqueueBatch(guildIds: string[], priority = 0): void {
    guildIds.forEach((guildId) => this.enqueue(guildId, priority));
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing || !this.client) return;

    this.isProcessing = true;
    logger.info('Starting position update queue processing');

    while (this.queue.length > 0 || this.processing.size > 0) {
      while (this.processing.size < this.MAX_CONCURRENT && this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;
        this.processing.add(item.guildId);

        this.processGuild(item).catch((error) => {
          logger.error('Error processing guild in queue', error as Error, {
            guildId: item.guildId,
          });
        });
      }

      await this.delay(this.BATCH_DELAY_MS);
    }

    this.isProcessing = false;
    logger.info('Position update queue processing completed', this.getStats());
  }

  private async processGuild(item: QueueItem): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug('Processing guild update', {
        guildId: item.guildId,
        queueTime: Date.now() - item.addedAt,
        retries: item.retries,
      });

      if (!this.client) {
        throw new Error('Client not initialized');
      }
      await this.updateUseCase.execute(item.guildId, this.client);

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      logger.debug('Guild update completed', {
        guildId: item.guildId,
        processingTime,
        remaining: this.queue.length,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.warn('Failed to update guild position', {
        guildId: item.guildId,
        error: error instanceof Error ? error.message : String(error),
        retries: item.retries,
        processingTime,
      });

      if (item.retries < this.MAX_RETRIES) {
        item.retries++;
        this.stats.retried++;

        setTimeout(() => {
          item.priority = -1;
          this.queue.push(item);
          this.queue.sort((a, b) => b.priority - a.priority);
        }, this.RETRY_DELAY_MS);
      } else {
        this.updateStats(false, processingTime);
        logger.error('Guild update failed after max retries', error as Error, {
          guildId: item.guildId,
          retries: item.retries,
        });
      }
    } finally {
      this.processing.delete(item.guildId);
    }
  }

  private isInQueue(guildId: string): boolean {
    return this.queue.some((item) => item.guildId === guildId);
  }

  private updateStats(success: boolean, processingTime: number): void {
    if (success) {
      this.stats.processed++;
    } else {
      this.stats.failed++;
    }

    this.stats.lastProcessingTimes.push(processingTime);
    if (this.stats.lastProcessingTimes.length > 100) {
      this.stats.lastProcessingTimes.shift();
    }

    this.stats.avgProcessingTime =
      this.stats.lastProcessingTimes.reduce((a, b) => a + b, 0) / this.stats.lastProcessingTimes.length;
  }

  getStats(): {
    queueLength: number;
    processing: number;
    processed: number;
    failed: number;
    retried: number;
    avgProcessingTime: number;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      processed: this.stats.processed,
      failed: this.stats.failed,
      retried: this.stats.retried,
      avgProcessingTime: Math.round(this.stats.avgProcessingTime),
    };
  }

  clear(): void {
    this.queue = [];
    logger.info('Position update queue cleared');
  }

  getQueueState(): {
    queue: Array<{ guildId: string; priority: number; waitTime: number }>;
    processing: string[];
  } {
    return {
      queue: this.queue.map((item) => ({
        guildId: item.guildId,
        priority: item.priority,
        waitTime: Date.now() - item.addedAt,
      })),
      processing: Array.from(this.processing),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
