import type { DBRepository } from '../../../repositories/database-repository';
import { computeNAV } from '../nav';
import { recordEvent } from '../recorder';
import { Logger } from '../../../utils/logger';

export function deposit(repo: DBRepository, user: string, amount: number): void {
  const db = repo.getDB();
  const { nav } = computeNAV(db);
  const newShares = amount / nav;
  const rec = db.users[user] || { shares: 0, totalDeposited: 0, withdrawnTotal: 0 };
  rec.shares += newShares;
  rec.totalDeposited += amount;
  db.users[user] = rec;
  db.totalShares += newShares;
  db.cash += amount;
  Logger.info(`✅ [Deposit] ${user} dépose $${amount.toFixed(6)} → +${newShares.toFixed(6)} shares`);
  recordEvent(repo, {
    timestamp: new Date().toISOString(),
    type: 'deposit',
    user,
    amount,
    shares: newShares,
  });
}
