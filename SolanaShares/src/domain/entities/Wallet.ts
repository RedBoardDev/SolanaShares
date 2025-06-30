export interface EncryptedSeed {
  cipherSeed: string;
  cipherDataKey: string;
  nonce: string;
}

export class Wallet {
  constructor(
    public readonly userId: string,
    public readonly walletAddress: string,
    public readonly encryptedSeed: EncryptedSeed,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(
    userId: string,
    walletAddress: string,
    encryptedSeed: EncryptedSeed
  ): Wallet {
    return new Wallet(userId, walletAddress, encryptedSeed);
  }
}