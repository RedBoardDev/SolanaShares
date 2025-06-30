import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import * as bip39 from 'bip39';
import { SolanaService, WalletService, KeyPair } from '../../domain/ports/services';
import { env } from '../../config/environment';

export class SolanaFacade implements SolanaService, WalletService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'), 'confirmed');
  }

  async generateKeyPair(): Promise<KeyPair> {
    // Generate a new keypair directly without mnemonic
    const keypair = Keypair.generate();
    
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: keypair.secretKey,
    };
  }

  getAddressFromPublicKey(publicKey: string): string {
    return publicKey; // In Solana, the public key IS the address
  }

  generateMnemonic(): string {
    return bip39.generateMnemonic();
  }

  getKeyPairFromPrivateKey(privateKey: Uint8Array): KeyPair {
    const keypair = Keypair.fromSecretKey(privateKey);
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: keypair.secretKey,
    };
  }

  async getBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      throw new Error(`Failed to get balance for ${address}: ${error}`);
    }
  }

  async transfer(fromPrivateKey: Uint8Array, toAddress: string, amount: number): Promise<string> {
    try {
      const fromKeypair = Keypair.fromSecretKey(fromPrivateKey);
      const toPublicKey = new PublicKey(toAddress);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      return signature;
    } catch (error) {
      throw new Error(`Transfer failed: ${error}`);
    }
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const confirmation = await this.connection.getSignatureStatus(signature);
      return confirmation.value?.confirmationStatus === 'confirmed' || 
             confirmation.value?.confirmationStatus === 'finalized';
    } catch (error) {
      throw new Error(`Failed to confirm transaction ${signature}: ${error}`);
    }
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async transferWithRetry(
    fromPrivateKey: Uint8Array,
    toAddress: string,
    amount: number,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const signature = await this.transfer(fromPrivateKey, toAddress, amount);
        return signature;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 500; // Exponential backoff: 0.5s, 1s, 2s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Transfer failed after all retries');
  }
}