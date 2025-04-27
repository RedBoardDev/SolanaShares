import type { DBRepository } from '@repositories/database-repository';

export interface UserStats {
  user: string;
  shares: number;
  percent: number;
  depositTotal: number;
  withdrawnTotal: number;
  currentValue: number;
  profitLoss: number;
}

export function getUserStats(repo: DBRepository, user: string): UserStats {
  const rec = repo.getUserRecord(user);
  const { nav } = repo.computeNAV();
  const currentValue = rec.shares * nav;
  const profitLoss = rec.withdrawnTotal + currentValue - rec.totalDeposited;

  return {
    user,
    shares: rec.shares,
    percent: repo.getTotalShares() ? (rec.shares / repo.getTotalShares()) * 100 : 0,
    depositTotal: rec.totalDeposited,
    withdrawnTotal: rec.withdrawnTotal,
    currentValue,
    profitLoss,
  };
}
