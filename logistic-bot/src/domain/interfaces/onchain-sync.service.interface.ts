import type { ParticipantEntity } from '@domain/entities/participant.entity';
import type { WalletDetails } from '@infrastructure/services/onchain-sync.service';

export interface OnChainSyncService {
  /* Synchronize a specific wallet's transactions */
  syncWalletTransactions(walletAddress: string): Promise<ParticipantEntity | null>;

  /* Synchronize all registered participants' transactions */
  syncAllParticipants(): Promise<WalletDetails[]>;

  /* Get sync status for a wallet */
  getSyncStatus(walletAddress: string): Promise<{
    lastSyncTimestamp: number;
    transactionCount: number;
    isUpToDate: boolean;
  }>;
}
