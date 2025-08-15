import type { GlobalStatsEntity } from '@domain/entities/global-stats.entity';

export interface GlobalStatsRepository {
  /* Get current global statistics */
  getGlobalStats(): Promise<GlobalStatsEntity>;

  /* Update global statistics atomically */
  updateGlobalStats(stats: GlobalStatsEntity): Promise<void>;

  /* Initialize global stats if they don't exist */
  initializeIfNotExists(): Promise<void>;

  /* Atomic increment operations for performance */
  incrementParticipant(investedAmount?: number): Promise<void>;

  /* Atomic decrement operations for performance */
  decrementParticipant(investedAmount: number): Promise<void>;

  /* Update invested amount for a participant */
  updateInvestedAmount(oldAmount: number, newAmount: number): Promise<void>;
}
