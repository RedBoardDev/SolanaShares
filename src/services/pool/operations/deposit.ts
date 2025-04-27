import type { DBRepository } from '@repositories/database-repository';
import { recordEvent } from '../recorder';
import { Logger } from '@utils/logger';

export function deposit(repo: DBRepository, user: string, amount: number): void {
  const { nav } = repo.computeNAV();
  const newShares = amount / nav;

  // update user record
  const rec = repo.getUserRecord(user);
  rec.shares += newShares;
  rec.totalDeposited += amount;
  repo.upsertUserRecord(user, rec);

  // update pool totals
  repo.updateTotalShares(newShares);
  repo.updateCash(repo.getCash() + amount);

  Logger.info(`✅ [Deposit] ${user} dépose $${amount.toFixed(6)} → +${newShares.toFixed(6)} shares`);
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'deposit',
    user,
    amount,
    shares: newShares,
  });
}
