export interface Participant {
  userId: string;
  walletAddress: string;
  investedAmount: number;
  createdAt: number;
  updatedAt: number;
}

export class ParticipantEntity {
  private constructor(
    private readonly _userId: string,
    private readonly _walletAddress: string,
    private _investedAmount: number,
    private readonly _createdAt: number,
    private _updatedAt: number,
  ) {
    this.validateInvariants();
  }

  static create(
    userId: string,
    walletAddress: string,
    investedAmount = 0,
  ): ParticipantEntity {
    if (!userId.trim()) {
      throw new Error('User ID is required');
    }
    if (!walletAddress.trim() || walletAddress.length < 32) {
      throw new Error('Invalid wallet address');
    }
    if (investedAmount < 0) {
      throw new Error('Invested amount cannot be negative');
    }

    const now = Date.now();
    return new ParticipantEntity(userId, walletAddress, investedAmount, now, now);
  }

  static restore(data: Participant): ParticipantEntity {
    return new ParticipantEntity(
      data.userId,
      data.walletAddress,
      data.investedAmount,
      data.createdAt,
      data.updatedAt,
    );
  }

  get userId(): string {
    return this._userId;
  }

  get walletAddress(): string {
    return this._walletAddress;
  }

  get investedAmount(): number {
    return this._investedAmount;
  }

  get createdAt(): number {
    return this._createdAt;
  }

  get updatedAt(): number {
    return this._updatedAt;
  }

  getShortWalletAddress(): string {
    return `${this._walletAddress.slice(0, 8)}...${this._walletAddress.slice(-8)}`;
  }

  updateInvestedAmount(newAmount: number): ParticipantEntity {
    if (newAmount < 0) {
      throw new Error('Invested amount cannot be negative');
    }

    return new ParticipantEntity(
      this._userId,
      this._walletAddress,
      newAmount,
      this._createdAt,
      Date.now(),
    );
  }

  updateCheckpoint(newInvestedAmount: number): ParticipantEntity {
    if (newInvestedAmount < 0) {
      throw new Error('Invested amount cannot be negative');
    }

    return new ParticipantEntity(
      this._userId,
      this._walletAddress,
      newInvestedAmount,
      this._createdAt,
      Date.now(),
    );
  }

  toData(): Participant {
    return {
      userId: this._userId,
      walletAddress: this._walletAddress,
      investedAmount: this._investedAmount,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private validateInvariants(): void {
    if (this._investedAmount < 0) {
      throw new Error('Invested amount cannot be negative');
    }
  }
}