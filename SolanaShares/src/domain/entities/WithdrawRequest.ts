export enum WithdrawStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED'
}

export class WithdrawRequest {
  constructor(
    public readonly withdrawId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly status: WithdrawStatus,
    public readonly signature?: string,
    public readonly createdAt: Date = new Date(),
    public readonly processedAt?: Date
  ) {}

  static create(withdrawId: string, userId: string, amount: number): WithdrawRequest {
    return new WithdrawRequest(withdrawId, userId, amount, WithdrawStatus.PENDING);
  }

  markAsProcessing(): WithdrawRequest {
    return new WithdrawRequest(
      this.withdrawId,
      this.userId,
      this.amount,
      WithdrawStatus.PROCESSING,
      this.signature,
      this.createdAt,
      this.processedAt
    );
  }

  markAsDone(signature: string): WithdrawRequest {
    return new WithdrawRequest(
      this.withdrawId,
      this.userId,
      this.amount,
      WithdrawStatus.DONE,
      signature,
      this.createdAt,
      new Date()
    );
  }

  markAsFailed(): WithdrawRequest {
    return new WithdrawRequest(
      this.withdrawId,
      this.userId,
      this.amount,
      WithdrawStatus.FAILED,
      this.signature,
      this.createdAt,
      new Date()
    );
  }
}