import type { DBRepository } from '@repositories/database-repository';
import { Logger } from '@utils/logger';
import { recordEvent } from '../recorder';

export function closePosition(repo: DBRepository, afterBalance: number): void {
  const db = repo.getDB();
  if (db.positionSize <= 0) {
    Logger.info('⚠️  [ClosePosition] pas de position ouverte');
    return;
  }
  const beforeBalance = db.cash + db.positionSize;
  const pnl = afterBalance - beforeBalance;
  db.cash = afterBalance;
  db.positionSize = 0;
  Logger.info(
    `🏁 [ClosePosition] wallet_before=$${beforeBalance.toFixed(6)}, wallet_after=$${afterBalance.toFixed(6)} → PnL=$${pnl.toFixed(6)}`,
  );
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'closePosition',
    afterBalance,
    pnl,
  });
}
