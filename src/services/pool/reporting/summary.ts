import type { DB } from '../../../domain/database';
import { computeNAV } from '../nav';
import { Logger } from '../../../utils/logger';

export function printSummary(db: DB): void {
  const { nav, poolAssets } = computeNAV(db);
  Logger.info('\n🗒️  [SUMMARY]');
  Logger.info(
    ` PoolAssets = $${poolAssets.toFixed(6)} | NAV = ${nav.toFixed(6)} | TotalShares = ${db.totalShares.toFixed(6)}`,
  );
  Logger.summary([
    '| User    | Shares      | % Pool    | Deposited ($) | Withdrawn ($) | Value ($)    | P/L ($)      |',
    '|---------|-------------|-----------|---------------|---------------|--------------|--------------|',
  ]);
  for (const [user, r] of Object.entries(db.users)) {
    const { shares, totalDeposited, withdrawnTotal } = r;
    const value = shares * nav;
    const percent = db.totalShares ? (shares / db.totalShares) * 100 : 0;
    const profitLoss = withdrawnTotal + value - totalDeposited;
    const line = `| ${user.padEnd(7)} | ${shares.toFixed(6).padStart(11)} | ${percent.toFixed(4).padStart(9)}% | ${totalDeposited.toFixed(2).padStart(13)} | ${withdrawnTotal.toFixed(2).padStart(13)} | ${value.toFixed(6).padStart(12)} | ${profitLoss.toFixed(6).padStart(12)} |`;
    Logger.info(line);
  }
  Logger.info('--------------------------------------------------------------------------------');
}
