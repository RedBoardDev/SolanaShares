export enum SnapshotStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface UserShares {
  [userId: string]: number;
}

export class Snapshot {
  constructor(
    public readonly snapshotId: string,
    public readonly userShares: UserShares,
    public readonly totalBalance: number,
    public readonly status: SnapshotStatus,
    public readonly timestamp: Date = new Date()
  ) {}

  static create(
    snapshotId: string,
    userShares: UserShares,
    totalBalance: number
  ): Snapshot {
    return new Snapshot(snapshotId, userShares, totalBalance, SnapshotStatus.PENDING);
  }

  markAsCompleted(): Snapshot {
    return new Snapshot(
      this.snapshotId,
      this.userShares,
      this.totalBalance,
      SnapshotStatus.COMPLETED,
      this.timestamp
    );
  }

  markAsFailed(): Snapshot {
    return new Snapshot(
      this.snapshotId,
      this.userShares,
      this.totalBalance,
      SnapshotStatus.FAILED,
      this.timestamp
    );
  }

  getUserShare(userId: string): number {
    return this.userShares[userId] || 0;
  }

  getTotalUsers(): number {
    return Object.keys(this.userShares).length;
  }
}