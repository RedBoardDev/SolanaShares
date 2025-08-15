import { OnChainSchedulerService } from '@infrastructure/services/onchain-scheduler.service';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import { logger } from '@helpers/logger';

export class SyncStatusEmbed {
  private static formatTimestamp(ms?: number): string {
    if (!ms) return 'N/A';
    const sec = Math.floor(ms / 1000);
    return `<t:${sec}:R>`;
  }

  private static formatDuration(start?: number, end?: number): string {
    if (!start || !end || end < start) return 'N/A';
    const ms = end - start;
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    const hr = Math.floor(ms / (1000 * 60 * 60));
    const parts: string[] = [];
    if (hr > 0) parts.push(`${hr}h`);
    if (min > 0) parts.push(`${min}m`);
    parts.push(`${sec}s`);
    return parts.join(' ');
  }

  public static getNextSyncInfo(): string {
    try {
      const scheduler = OnChainSchedulerService.getInstance();
      const timing = scheduler.getTimeUntilNextSync();

      if (timing.minutes === -1) {
        return 'Phase started - no more syncs';
      } else if (timing.minutes === 0) {
        return 'Next sync: Now';
      } else if (timing.minutes === 1) {
        return 'Next sync: 1 minute';
      } else {
        return `Next sync: ${timing.minutes} minutes`;
      }
    } catch (error) {
      logger.warn('Failed to get next sync info', { error: error instanceof Error ? error.message : String(error) });
      return 'Next sync: Unknown';
    }
  }

  public static renderLiveStatus(scheduler: OnChainSchedulerService): string {
    const status = scheduler.getSchedulerStatus();
    const onchain = status.onchain;

    const running = onchain.isRunning
      ? '🟡 In progress'
      : (onchain.stage === 'completed' ? '🟢 Completed' : (onchain.stage === 'error' ? '🔴 Error' : '🟢 Idle'));

    const partsTotal = onchain.totalParticipants ?? 0;
    const partsDone = onchain.processedParticipants ?? 0;
    const txTotal = onchain.totalTransactions ?? 0;
    const txDone = onchain.processedTransactions ?? 0;
    const stage = onchain.stage;
    const startedAt = this.formatTimestamp(onchain.startedAt);
    const updatedAt = this.formatTimestamp(onchain.updatedAt);

    return `${running}\nStage: ${stage}\nParticipants: ${partsDone}/${partsTotal}\nTransactions: ${txDone}/${txTotal}\nStarted: ${startedAt}\nUpdated: ${updatedAt}${onchain.error ? `\nError: ${onchain.error}` : ''}`;
  }

  public static async renderFinalStatus(scheduler: OnChainSchedulerService): Promise<string> {
    const finalStatus = scheduler.getSchedulerStatus();

    if (finalStatus.onchain.stage === 'completed') {
      try {
        const repo = new DynamoParticipantRepository();
        const gs = await repo.getGlobalStats();
        const partsTotal = finalStatus.onchain.totalParticipants ?? 0;
        const partsDone = finalStatus.onchain.processedParticipants ?? partsTotal;
        const txTotal = finalStatus.onchain.totalTransactions ?? 0;
        const txDone = finalStatus.onchain.processedTransactions ?? txTotal;
        const duration = this.formatDuration(finalStatus.onchain.startedAt, finalStatus.onchain.updatedAt);

        return `Results: ${gs.totalInvested.toFixed(4)} SOL\nStage: ${finalStatus.onchain.stage}\nParticipants: ${partsDone}/${partsTotal}\nTransactions: ${txDone}/${txTotal}\nDuration: ${duration}`;
      } catch (err) {
        logger.error('Failed to fetch global stats after sync', err as Error);
        const s = scheduler.getSchedulerStatus();
        const partsTotal = s.onchain.totalParticipants ?? 0;
        const partsDone = s.onchain.processedParticipants ?? partsTotal;
        const txTotal = s.onchain.totalTransactions ?? 0;
        const txDone = s.onchain.processedTransactions ?? txTotal;
        const duration = this.formatDuration(s.onchain.startedAt, s.onchain.updatedAt);
        return `Results: (unavailable)\nStage: ${s.onchain.stage}\nParticipants: ${partsDone}/${partsTotal}\nTransactions: ${txDone}/${txTotal}\nDuration: ${duration}`;
      }
    } else if (finalStatus.onchain.stage === 'error') {
      const duration = this.formatDuration(finalStatus.onchain.startedAt, finalStatus.onchain.updatedAt);
      const partsTotal = finalStatus.onchain.totalParticipants ?? 0;
      const partsDone = finalStatus.onchain.processedParticipants ?? 0;
      const txTotal = finalStatus.onchain.totalTransactions ?? 0;
      const txDone = finalStatus.onchain.processedTransactions ?? 0;
      return `Results: (failed)\nStage: ${finalStatus.onchain.stage}\nParticipants: ${partsDone}/${partsTotal}\nTransactions: ${txDone}/${txTotal}\nDuration: ${duration}${finalStatus.onchain.error ? `\nError: ${finalStatus.onchain.error}` : ''}`;
    } else {
      return this.renderLiveStatus(scheduler);
    }
  }
}

