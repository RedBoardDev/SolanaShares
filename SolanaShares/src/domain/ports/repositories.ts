import { User } from '../entities/User';
import { Wallet } from '../entities/Wallet';
import { Transaction } from '../entities/Transaction';
import { WithdrawRequest } from '../entities/WithdrawRequest';
import { Snapshot } from '../entities/Snapshot';

export interface UserRepository {
  findByUserId(userId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  findAll(): Promise<User[]>;
}

export interface WalletRepository {
  findByUserId(userId: string): Promise<Wallet | null>;
  findByAddress(address: string): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<Wallet>;
  findAll(): Promise<Wallet[]>;
}

export interface TransactionRepository {
  findById(txId: string): Promise<Transaction | null>;
  findBySignature(signature: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<Transaction>;
  findByUserId(userId: string): Promise<Transaction[]>;
  findPendingTransactions(): Promise<Transaction[]>;
}

export interface WithdrawRequestRepository {
  findById(withdrawId: string): Promise<WithdrawRequest | null>;
  save(withdrawRequest: WithdrawRequest): Promise<WithdrawRequest>;
  findByUserId(userId: string): Promise<WithdrawRequest[]>;
  findPendingRequests(): Promise<WithdrawRequest[]>;
}

export interface SnapshotRepository {
  findById(snapshotId: string): Promise<Snapshot | null>;
  save(snapshot: Snapshot): Promise<Snapshot>;
  findLatest(): Promise<Snapshot | null>;
  findAll(): Promise<Snapshot[]>;
}