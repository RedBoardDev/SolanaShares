import { logger } from '@helpers/logger';
import { config } from '@infrastructure/config/env';
import { OnChainSyncService, type SyncStatus } from '@infrastructure/services/onchain-sync.service';

const SYNC_INTERVAL_MINUTES = 60;
const PHASE_END_DAYS = 1;

export class OnChainSchedulerService {
  private static instance: OnChainSchedulerService;
  private readonly onchainService: OnChainSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSyncTime: number = Date.now();
  private isPhaseEnded = false;
  private readonly SYNC_INTERVAL_MS = SYNC_INTERVAL_MINUTES * 60 * 1000;

  private constructor() {
    this.onchainService = OnChainSyncService.getInstance();
    this.checkPhaseStatus();
  }

  public static getInstance(): OnChainSchedulerService {
    if (!OnChainSchedulerService.instance) {
      OnChainSchedulerService.instance = new OnChainSchedulerService();
    }
    return OnChainSchedulerService.instance;
  }

  private checkPhaseStatus(): void {
    try {
      const phaseStartDate = new Date(config.solana.phase.startDate);
      const now = new Date();
      const daysSinceStart = (now.getTime() - phaseStartDate.getTime()) / (1000 * 60 * 60 * 24);

      this.isPhaseEnded = daysSinceStart > PHASE_END_DAYS;
    } catch (error) {
      logger.warn('Failed to check phase status, defaulting to enabled', { error: error instanceof Error ? error.message : String(error) });
      this.isPhaseEnded = false;
    }
  }

  private shouldSkipSync(): boolean {
    this.checkPhaseStatus();
    logger.debug('isPhaseEnded', { isPhaseEnded: this.isPhaseEnded });
    return this.isPhaseEnded;
  }

  private async executeSync(): Promise<void> {
    if (this.shouldSkipSync()) {
      return;
    }
    logger.debug('executeSync');
    try {
      await this.onchainService.syncAllParticipants(this.getPhaseStartDate());
      this.lastSyncTime = Date.now();
    } catch (error) {
      logger.error('On-chain sync failed', error as Error);
    }
  }

  public startScheduler(): void {
    logger.info('Starting on-chain scheduler', { isRunning: this.isRunning });
    if (this.isRunning) {
      logger.warn('On-chain scheduler already running');
      return;
    }

    try {
      logger.info('startScheduler');

      this.syncInterval = setInterval(() => {
        if (this.shouldSkipSync()) {
          logger.debug('Skipping scheduled sync - phase ended');
          return;
        }
        void this.executeSync();
      }, this.SYNC_INTERVAL_MS);

      this.isRunning = true;
      logger.info(`✅ On-chain scheduler started - sync will run every ${SYNC_INTERVAL_MINUTES} minutes`);

      setTimeout(() => {
        if (!this.shouldSkipSync()) {
          void this.executeSync();
        }
      }, 5000);

    } catch (error) {
      logger.error('Failed to start on-chain scheduler', error as Error);
    }
  }

  public stopScheduler(): void {
    if (!this.isRunning) {
      logger.warn('On-chain scheduler not running');
      return;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
  }

  public isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  public getLastSyncTime(): number | null {
    return this.lastSyncTime;
  }

  public getSchedulerStatus(): {
    isRunning: boolean;
    lastSyncTime: number | null;
    nextSyncIn: number | null;
    lastSyncFormatted: string | null;
    onchain: SyncStatus;
    isPhaseEnded: boolean;
  } {
    let nextSyncIn: number | null = null;

    if (this.isRunning && !this.isPhaseEnded && this.lastSyncTime) {
      const timeSinceLast = Date.now() - this.lastSyncTime;
      nextSyncIn = Math.max(0, this.SYNC_INTERVAL_MS - timeSinceLast);
    }

    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn,
      lastSyncFormatted: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
      onchain: this.onchainService.getSyncStatus(),
      isPhaseEnded: this.isPhaseEnded,
    };
  }

  public async forceSyncNow(asOfDate: Date = this.getPhaseStartDate()): Promise<void> {
    const current = this.onchainService.getSyncStatus();
    if (current.isRunning) {
      logger.warn('On-chain sync already running, forceSyncNow ignored');
      return;
    }

    await this.onchainService.syncAllParticipants(asOfDate);
  }

  public getTimeUntilNextSync(): { minutes: number; formatted: string } {
    if (this.shouldSkipSync()) {
      return { minutes: -1, formatted: 'Phase ended - no more syncs' };
    }

    const now = Date.now();
    const nextSyncTime = this.lastSyncTime ? this.lastSyncTime + this.SYNC_INTERVAL_MS : now;
    const msUntilNext = Math.max(0, nextSyncTime - now);
    const minutesUntilNext = Math.ceil(msUntilNext / (60 * 1000));

    let formatted: string;
    if (minutesUntilNext === 0) formatted = 'Now';
    else if (minutesUntilNext === 1) formatted = '1 minute';
    else formatted = `${minutesUntilNext} minutes`;

    return { minutes: minutesUntilNext, formatted };
  }

  private getPhaseStartDate(): Date {
    const d = new Date(config.solana.phase.startDate);
    if (!Number.isNaN(d.getTime())) return d;
    throw new Error('Invalid phase start date');
  }
}
