import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface Investment {
  id: number;
  userId: string;
  username: string;
  amount: number;
  timestamp: number;
  signature: string;
}

export interface UserWallet {
  id: number;
  userId: string;
  username: string;
  walletAddress: string;
  createdAt: number;
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
        timestamp INTEGER NOT NULL,
        signature TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        walletAddress TEXT UNIQUE NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pool_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        totalValue REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_investments_userId ON investments(userId);
      CREATE INDEX IF NOT EXISTS idx_investments_timestamp ON investments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_investments_signature ON investments(signature);
      CREATE INDEX IF NOT EXISTS idx_wallets_userId ON user_wallets(userId);
      CREATE INDEX IF NOT EXISTS idx_wallets_address ON user_wallets(walletAddress);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON pool_snapshots(timestamp);
    `);
  }

  // Gestion des wallets utilisateurs
  async addUserWallet(userId: string, username: string, walletAddress: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT OR IGNORE INTO user_wallets (userId, username, walletAddress, createdAt) VALUES (?, ?, ?, ?)',
      [userId, username, walletAddress, Date.now()]
    );
  }

  async getUserWallet(userId: string): Promise<UserWallet | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT * FROM user_wallets WHERE userId = ?',
      [userId]
    );
    
    return result || null;
  }

  async getUserByWallet(walletAddress: string): Promise<UserWallet | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT * FROM user_wallets WHERE walletAddress = ?',
      [walletAddress]
    );
    
    return result || null;
  }

  // Gestion des investissements
  async addInvestment(userId: string, username: string, amount: number, signature: string, timestamp: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT OR IGNORE INTO investments (userId, username, amount, timestamp, signature) VALUES (?, ?, ?, ?, ?)',
      [userId, username, amount, timestamp, signature]
    );
  }

  async getInvestmentBySignature(signature: string): Promise<Investment | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.get(
      'SELECT * FROM investments WHERE signature = ?',
      [signature]
    );
    
    return result || null;
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
    
    const result = await this.db.get(
      'SELECT * FROM pool_snapshots ORDER BY timestamp DESC LIMIT 1'
    );
    
    return result || null;
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