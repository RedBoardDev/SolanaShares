import type { DBRepository } from '@repositories/database-repository';
import { Logger } from '@utils/logger';

export function printSummary(repo: DBRepository): void {
  const { nav, poolAssets } = repo.computeNAV();

  Logger.info('\n🗒️  [SUMMARY]');
  Logger.info(
    ` PoolAssets = $${poolAssets.toFixed(6)} | NAV = ${nav.toFixed(6)} | TotalShares = ${repo
      .getTotalShares()
      .toFixed(6)}`,
  );
  Logger.summary([
    '| User    | Shares      | % Pool    | Deposited ($) | Withdrawn ($) | Value ($)    | P/L ($)      |',
    '|---------|-------------|-----------|---------------|---------------|--------------|--------------|',
  ]);

  for (const [user, r] of repo.getAllUsers()) {
    const { shares, totalDeposited, withdrawnTotal } = r;
    const value = shares * nav;
    const percent = repo.getTotalShares() ? (shares / repo.getTotalShares()) * 100 : 0;
    const profitLoss = withdrawnTotal + value - totalDeposited;
    const line = `| ${user.padEnd(7)} | ${shares.toFixed(6).padStart(11)} | ${percent
      .toFixed(4)
      .padStart(9)}% | ${totalDeposited.toFixed(2).padStart(13)} | ${withdrawnTotal
      .toFixed(2)
      .padStart(13)} | ${value.toFixed(6).padStart(12)} | ${profitLoss.toFixed(6).padStart(12)} |`;
    Logger.info(line);
  }

  Logger.info('--------------------------------------------------------------------------------');
}
