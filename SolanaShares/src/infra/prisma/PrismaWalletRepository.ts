import { PrismaClient } from '@prisma/client';
import { WalletRepository } from '../../domain/ports/repositories';
import { Wallet, EncryptedSeed } from '../../domain/entities/Wallet';

export class PrismaWalletRepository implements WalletRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<Wallet | null> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) return null;

    return new Wallet(
      wallet.userId,
      wallet.walletAddress,
      {
        cipherSeed: wallet.cipherSeed,
        cipherDataKey: wallet.cipherDataKey,
        nonce: wallet.nonce,
      },
      wallet.createdAt,
      wallet.updatedAt
    );
  }

  async findByAddress(address: string): Promise<Wallet | null> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { walletAddress: address },
    });

    if (!wallet) return null;

    return new Wallet(
      wallet.userId,
      wallet.walletAddress,
      {
        cipherSeed: wallet.cipherSeed,
        cipherDataKey: wallet.cipherDataKey,
        nonce: wallet.nonce,
      },
      wallet.createdAt,
      wallet.updatedAt
    );
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const saved = await this.prisma.userWallet.upsert({
      where: { userId: wallet.userId },
      update: {
        walletAddress: wallet.walletAddress,
        cipherSeed: wallet.encryptedSeed.cipherSeed,
        cipherDataKey: wallet.encryptedSeed.cipherDataKey,
        nonce: wallet.encryptedSeed.nonce,
        updatedAt: new Date(),
      },
      create: {
        userId: wallet.userId,
        walletAddress: wallet.walletAddress,
        cipherSeed: wallet.encryptedSeed.cipherSeed,
        cipherDataKey: wallet.encryptedSeed.cipherDataKey,
        nonce: wallet.encryptedSeed.nonce,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });

    return new Wallet(
      saved.userId,
      saved.walletAddress,
      {
        cipherSeed: saved.cipherSeed,
        cipherDataKey: saved.cipherDataKey,
        nonce: saved.nonce,
      },
      saved.createdAt,
      saved.updatedAt
    );
  }

  async findAll(): Promise<Wallet[]> {
    const wallets = await this.prisma.userWallet.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return wallets.map(wallet => new Wallet(
      wallet.userId,
      wallet.walletAddress,
      {
        cipherSeed: wallet.cipherSeed,
        cipherDataKey: wallet.cipherDataKey,
        nonce: wallet.nonce,
      },
      wallet.createdAt,
      wallet.updatedAt
    ));
  }
}