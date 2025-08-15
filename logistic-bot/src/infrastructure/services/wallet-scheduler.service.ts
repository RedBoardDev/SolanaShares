import { WalletInfoService } from './wallet-info.service';
import { logger } from '@helpers/logger';

const SYNC_INTERVAL_MN = 10; // 10 minutes

export class WalletSchedulerService {
  private static instance: WalletSchedulerService;
  private walletService: WalletInfoService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSyncTime: number = Date.now();
  private readonly SYNC_INTERVAL_MS = SYNC_INTERVAL_MN * 60 * 1000;

  private constructor() {
    this.walletService = WalletInfoService.getInstance();
  }

  public static getInstance(): WalletSchedulerService {
    if (!WalletSchedulerService.instance) {
      WalletSchedulerService.instance = new WalletSchedulerService();
    }
    return WalletSchedulerService.instance;
  }

  public startScheduler(): void {
    if (this.isRunning) {
      logger.warn('Wallet scheduler is already running');
      return;
    }

    try {
      this.syncInterval = setInterval(() => {
        this.runWalletSync();
      }, this.SYNC_INTERVAL_MS);

      this.isRunning = true;
      logger.info(`✅ Wallet scheduler started - sync will run every ${SYNC_INTERVAL_MN} minutes`);

      setTimeout(() => {
        this.runWalletSync();
      }, 30 * 1000);

    } catch (error) {
      logger.error('Failed to start wallet scheduler:', error as Error);
    }
  }

  public stopScheduler(): void {
    if (!this.isRunning) {
      logger.warn('Wallet scheduler is not running');
      return;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
    logger.info('🛑 Wallet scheduler stopped');
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
  } {
    let nextSyncIn: number | null = null;

    if (this.isRunning && this.lastSyncTime) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      nextSyncIn = Math.max(0, this.SYNC_INTERVAL_MS - timeSinceLastSync);
    }

    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn,
      lastSyncFormatted: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
    };
  }

  public async forceSyncNow(): Promise<void> {
    logger.info('🔄 Manual wallet sync triggered');
    await this.runWalletSync();
  }

  private async runWalletSync(): Promise<void> {
    const startTime = Date.now();
    logger.info('🔄 Starting scheduled wallet information sync');

    try {
      await this.walletService.updateWalletInfo();

      this.lastSyncTime = Date.now();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ Scheduled wallet sync completed successfully in ${duration}s`);

    } catch (error) {
      logger.error('❌ Scheduled wallet sync failed:', error as Error);
    }
  }

  public getTimeUntilNextSync(): { minutes: number; formatted: string } {
    const now = Date.now();
    let nextSyncTime: number;

    if (this.lastSyncTime) {
      nextSyncTime = this.lastSyncTime + this.SYNC_INTERVAL_MS;
    } else {
      nextSyncTime = now;
    }

    const msUntilNext = Math.max(0, nextSyncTime - now);
    const minutesUntilNext = Math.ceil(msUntilNext / (60 * 1000));

    let formatted: string;
    if (minutesUntilNext === 0) {
      formatted = 'Now';
    } else if (minutesUntilNext === 1) {
      formatted = '1 minute';
    } else {
      formatted = `${minutesUntilNext} minutes`;
    }

    return {
      minutes: minutesUntilNext,
      formatted,
    };
  }
}
