import type { DBRepository } from '@repositories/database-repository';
import * as operations from './operations';
import * as reporting from './reporting';

export class Pool {
  private db = this.repo.getDB();

  constructor(private repo: DBRepository) {}

  deposit(user: string, amount: number): void {
    operations.deposit(this.repo, user, amount);
  }

  openPosition(beforeBalance: number, addedLiquidity: number): void {
    operations.openPosition(this.repo, beforeBalance, addedLiquidity);
  }

  closePosition(afterBalance: number): void {
    operations.closePosition(this.repo, afterBalance);
  }

  withdraw(user: string, redeemShares: number): void {
    operations.withdraw(this.repo, user, redeemShares);
  }

  printSummary(): void {
    reporting.printSummary(this.db);
  }

  getUserStats(user: string) {
    return reporting.getUserStats(this.db, user);
  }
}
