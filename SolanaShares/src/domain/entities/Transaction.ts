export enum TransactionType {
  SWEEP_IN = 'SWEEP_IN',
  WITHDRAW = 'WITHDRAW',
  ADMIN_TRANSFER = 'ADMIN_TRANSFER'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

export class Transaction {
  constructor(
    public readonly txId: string,
    public readonly signature: string,
    public readonly txType: TransactionType,
    public readonly amount: number,
    public readonly status: TransactionStatus,
    public readonly userId?: string,
    public readonly retryCount: number = 0,
    public readonly errorMsg?: string,
    public readonly createdAt: Date = new Date(),
    public readonly confirmedAt?: Date
  ) {}

  static create(
    txId: string,
    signature: string,
    txType: TransactionType,
    amount: number,
    userId?: string
  ): Transaction {
    return new Transaction(
      txId,
      signature,
      txType,
      amount,
      TransactionStatus.PENDING,
      userId
    );
  }

  markAsConfirmed(): Transaction {
    return new Transaction(
      this.txId,
      this.signature,
      this.txType,
      this.amount,
      TransactionStatus.CONFIRMED,
      this.userId,
      this.retryCount,
      this.errorMsg,
      this.createdAt,
      new Date()
    );
  }

  markAsFailed(errorMsg: string): Transaction {
    return new Transaction(
      this.txId,
      this.signature,
      this.txType,
      this.amount,
      TransactionStatus.FAILED,
      this.userId,
      this.retryCount,
      errorMsg,
      this.createdAt,
      this.confirmedAt
    );
  }

  incrementRetry(): Transaction {
    return new Transaction(
      this.txId,
      this.signature,
      this.txType,
      this.amount,
      this.status,
      this.userId,
      this.retryCount + 1,
      this.errorMsg,
      this.createdAt,
      this.confirmedAt
    );
  }
}