import type { DBRepository } from '@repositories/database-repository';
import { Logger } from '@utils/logger';
import { recordEvent } from '../recorder';

export function withdraw(repo: DBRepository, user: string, redeemShares: number): void {
  const rec = repo.getUserRecord(user);
  if (redeemShares > rec.shares) {
    Logger.info(`❌ [Withdraw] ${user} n'a que ${rec.shares.toFixed(6)} shares`);
    return;
  }

  const { nav } = repo.computeNAV();
  const amount = redeemShares * nav;

  // update user
  rec.shares -= redeemShares;
  rec.withdrawnTotal += amount;
  repo.upsertUserRecord(user, rec);

  // update pool
  repo.updateTotalShares(-redeemShares);
  repo.updateCash(repo.getCash() - amount);

  Logger.info(`💸 [Withdraw] ${user} retire ${redeemShares.toFixed(6)} shares → $${amount.toFixed(6)}`);
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'withdraw',
    user,
    amount,
    shares: redeemShares,
  });
}
