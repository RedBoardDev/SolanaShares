export interface GlobalStats {
  type: string;
  totalInvested: number;
  participantCount: number;
  activeParticipants: number;
  updatedAt: number;
}

export class GlobalStatsEntity {
  private constructor(
    private _totalInvested: number,
    private _participantCount: number,
    private _activeParticipants: number,
    private _updatedAt: number,
  ) {
    this.validateInvariants();
  }

  static create(): GlobalStatsEntity {
    const now = Date.now();
    return new GlobalStatsEntity(0, 0, 0, now);
  }

  static restore(data: GlobalStats): GlobalStatsEntity {
    return new GlobalStatsEntity(
      data.totalInvested,
      data.participantCount,
      data.activeParticipants,
      data.updatedAt,
    );
  }

  get totalInvested(): number {
    return this._totalInvested;
  }

  get participantCount(): number {
    return this._participantCount;
  }

  get activeParticipants(): number {
    return this._activeParticipants;
  }

  get updatedAt(): number {
    return this._updatedAt;
  }

  incrementParticipant(investedAmount = 0, minSolAmount: number): GlobalStatsEntity {
    const newActiveParticipants = investedAmount >= minSolAmount ? this._activeParticipants + 1 : this._activeParticipants;

    return new GlobalStatsEntity(
      this._totalInvested + investedAmount,
      this._participantCount + 1,
      newActiveParticipants,
      Date.now(),
    );
  }

  decrementParticipant(investedAmount: number, minSolAmount: number): GlobalStatsEntity {
    const newActiveParticipants = investedAmount >= minSolAmount ? Math.max(0, this._activeParticipants - 1) : this._activeParticipants;

    return new GlobalStatsEntity(
      Math.max(0, this._totalInvested - investedAmount),
      Math.max(0, this._participantCount - 1),
      newActiveParticipants,
      Date.now(),
    );
  }

  updateInvestedAmount(oldAmount: number, newAmount: number, minSolAmount: number): GlobalStatsEntity {
    const difference = newAmount - oldAmount;
    const wasActive = oldAmount >= minSolAmount;
    const isActive = newAmount >= minSolAmount;

    let activeChange = 0;
    if (!wasActive && isActive) {
      activeChange = 1; // Becomes active
    } else if (wasActive && !isActive) {
      activeChange = -1; // Becomes inactive
    }

    return new GlobalStatsEntity(
      Math.max(0, this._totalInvested + difference),
      this._participantCount,
      Math.max(0, this._activeParticipants + activeChange),
      Date.now(),
    );
  }

  toData(): GlobalStats {
    return {
      type: 'GLOBAL_STATS',
      totalInvested: this._totalInvested,
      participantCount: this._participantCount,
      activeParticipants: this._activeParticipants,
      updatedAt: this._updatedAt,
    };
  }

  private validateInvariants(): void {
    if (this._totalInvested < 0) {
      throw new Error('Total invested cannot be negative');
    }
    if (this._participantCount < 0) {
      throw new Error('Participant count cannot be negative');
    }
    if (this._activeParticipants < 0) {
      throw new Error('Active participants count cannot be negative');
    }
    if (this._activeParticipants > this._participantCount) {
      throw new Error('Active participants cannot exceed total participants');
    }
  }
}