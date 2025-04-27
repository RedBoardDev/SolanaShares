import type { DB } from '../../domain/database';

export function computeNAV(db: DB): { nav: number; poolAssets: number } {
  const { cash, positionSize, totalShares } = db;
  const poolAssets = cash + positionSize;
  const nav = totalShares > 0 ? poolAssets / totalShares : 1;
  return { nav, poolAssets };
}
