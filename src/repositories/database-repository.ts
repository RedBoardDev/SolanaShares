import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '../domain/database';
import type { UserRecord } from '../domain/user-record';
import { computeNAV as computeNavFromModel } from '../services/pool/nav';
import type { Event } from '../domain/event';

export class DBRepository {
  private data: DB;

  constructor(private filePath: string) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      this.data = {
        totalShares: 0,
        users: {},
        cash: 0,
        positionSize: 0,
        history: [],
      };
      fs.writeFileSync(fullPath, JSON.stringify(this.data, null, 2));
    } else {
      this.data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  }

  // READERS
  getCash(): number {
    return this.data.cash;
  }

  getPositionSize(): number {
    return this.data.positionSize;
  }

  getTotalShares(): number {
    return this.data.totalShares;
  }

  getUserShares(user: string): number {
    return this.data.users[user]?.shares ?? 0;
  }

  getUserRecord(user: string): UserRecord {
    return this.data.users[user] ?? { shares: 0, totalDeposited: 0, withdrawnTotal: 0 };
  }

  getAllUsers(): Array<[string, UserRecord]> {
    return Object.entries(this.data.users);
  }

  computeNAV(): { nav: number; poolAssets: number } {
    return computeNavFromModel(this.data);
  }

  // MUTATORS
  updateCash(newCash: number): void {
    this.data.cash = newCash;
    this.save();
  }

  updatePositionSize(newSize: number): void {
    this.data.positionSize = newSize;
    this.save();
  }

  updateTotalShares(delta: number): void {
    this.data.totalShares += delta;
    this.save();
  }

  upsertUserRecord(user: string, record: UserRecord): void {
    this.data.users[user] = record;
    this.save();
  }

  pushEvent(event: Event): void {
    this.data.history.push(event);
    this.save();
  }

  private save(): void {
    fs.writeFileSync(path.resolve(this.filePath), JSON.stringify(this.data, null, 2));
  }
}
