import type { DBRepository } from '@repositories/database-repository';
import { computeNAV } from '../nav';
import { Logger } from '@utils/logger';
import { recordEvent } from '../recorder';

export function withdraw(repo: DBRepository, user: string, redeemShares: number): void {
  const db = repo.getDB();
  const rec = db.users[user];
  if (!rec || redeemShares > rec.shares) {
    Logger.info(`❌ [Withdraw] ${user} n'a que ${rec ? rec.shares.toFixed(6) : 0} shares`);
    return;
  }
  const { nav } = computeNAV(db);
  const amount = redeemShares * nav;
  rec.shares -= redeemShares;
  rec.withdrawnTotal += amount;
  db.totalShares -= redeemShares;
  db.cash -= amount;
  Logger.info(`💸 [Withdraw] ${user} retire ${redeemShares.toFixed(6)} shares → $${amount.toFixed(6)}`);
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'withdraw',
    user,
    amount,
    shares: redeemShares,
  });
}
