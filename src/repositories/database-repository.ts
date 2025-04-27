import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '@domain/database';

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

  getDB(): DB {
    return this.data;
  }

  save(): void {
    fs.writeFileSync(path.resolve(this.filePath), JSON.stringify(this.data, null, 2));
  }
}
