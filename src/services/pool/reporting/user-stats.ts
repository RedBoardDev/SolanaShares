import type { DB } from '@domain/database';
import { computeNAV } from '../nav';

export interface UserStats {
  user: string;
  shares: number;
  percent: number;
  depositTotal: number;
  withdrawnTotal: number;
  currentValue: number;
  profitLoss: number;
}

export function getUserStats(db: DB, user: string): UserStats {
  const rec = db.users[user] || { shares: 0, totalDeposited: 0, withdrawnTotal: 0 };
  const { nav } = computeNAV(db);
  const currentValue = rec.shares * nav;
  const profitLoss = rec.withdrawnTotal + currentValue - rec.totalDeposited;
  return {
    user,
    shares: rec.shares,
    percent: db.totalShares ? (rec.shares / db.totalShares) * 100 : 0,
    depositTotal: rec.totalDeposited,
    withdrawnTotal: rec.withdrawnTotal,
    currentValue,
    profitLoss,
  };
}
