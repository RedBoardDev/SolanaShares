import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface Investment {
  id: number;
  userId: string;
  username: string;
  amount: number;
  timestamp: number;
}

export interface PoolSnapshot {
  id: number;
  totalValue: number;
  timestamp: number;
}

class DatabaseManager {
  private db: Database | null = null;

  async initialize() {
    this.db = await open({
      filename: './pool.db',
      driver: sqlite3.Database
    });

    // Créer les tables si elles n'existent pas
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pool_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        totalValue REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_investments_userId ON investments(userId);
      CREATE INDEX IF NOT EXISTS idx_investments_timestamp ON investments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON pool_snapshots(timestamp);
    `);
  }

  async addInvestment(userId: string, username: string, amount: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT INTO investments (userId, username, amount, timestamp) VALUES (?, ?, ?, ?)',
      [userId, username, amount, Date.now()]
    );
  }

  async getUserInvestments(userId: string): Promise<Investment[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.all(
      'SELECT * FROM investments WHERE userId = ? ORDER BY timestamp ASC',
      [userId]
    );
  }

  async getAllInvestments(): Promise<Investment[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.all('SELECT * FROM investments ORDER BY timestamp ASC');
  }

  async addPoolSnapshot(totalValue: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT INTO pool_snapshots (totalValue, timestamp) VALUES (?, ?)',
      [totalValue, Date.now()]
    );
  }

  async getLatestSnapshot(): Promise<PoolSnapshot | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.get(
      'SELECT * FROM pool_snapshots ORDER BY timestamp DESC LIMIT 1'
    );
  }

  async getTotalInvestedByUser(userId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT SUM(amount) as total FROM investments WHERE userId = ?',
      [userId]
    );
    
    return result?.total || 0;
  }

  async getTotalInvested(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT SUM(amount) as total FROM investments'
    );
    
    return result?.total || 0;
  }

  async getUniqueInvestorsCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT COUNT(DISTINCT userId) as count FROM investments'
    );
    
    return result?.count || 0;
  }
}

export const db = new DatabaseManager();