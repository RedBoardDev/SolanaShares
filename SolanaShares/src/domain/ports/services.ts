import { EncryptedSeed } from '../entities/Wallet';

export interface KeyPair {
  publicKey: string;
  privateKey: Uint8Array;
}

export interface WalletService {
  generateKeyPair(): Promise<KeyPair>;
  getAddressFromPublicKey(publicKey: string): string;
  generateMnemonic(): string;
  getKeyPairFromPrivateKey(privateKey: Uint8Array): KeyPair;
}

export interface EncryptionService {
  encryptSeed(seed: string, keyId: string): Promise<EncryptedSeed>;
  decryptSeed(encryptedSeed: EncryptedSeed, keyId: string): Promise<string>;
}

export interface SolanaService {
  getBalance(address: string): Promise<number>;
  transfer(fromPrivateKey: Uint8Array, toAddress: string, amount: number): Promise<string>;
  confirmTransaction(signature: string): Promise<boolean>;
  isValidAddress(address: string): boolean;
}

export interface LoggerService {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface NotificationService {
  sendDiscordDM(userId: string, message: string): Promise<void>;
  sendDiscordAlert(message: string): Promise<void>;
}