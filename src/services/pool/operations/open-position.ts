import type { DBRepository } from '@repositories/database-repository';
import { Logger } from '@utils/logger';
import { recordEvent } from '../recorder';

export function openPosition(repo: DBRepository, beforeBalance: number, addedLiquidity: number): void {
  repo.updatePositionSize(addedLiquidity);
  repo.updateCash(beforeBalance - addedLiquidity);

  Logger.info(
    `🔄 [OpenPosition] wallet_before=$${beforeBalance.toFixed(6)} → addedLiquidity=$${addedLiquidity.toFixed(6)}, cash_left=$${repo
      .getCash()
      .toFixed(6)}`,
  );
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'openPosition',
    beforeBalance,
    addedLiquidity,
  });
}
