import type { WalletInfo, WalletPosition } from '@schemas/lpagent.schema';

export interface WalletInfoService {
  /** Get SOL balance for the configured wallet */
  getSolBalance(walletAddress?: string): Promise<number>;

  /** Get all opening positions from Meteora */
  getPositions(walletAddress?: string): Promise<WalletPosition[]>;

  /** Calculate total net worth including SOL + positions value + fees */
  getTotalNetWorth(walletAddress?: string): Promise<number>;

  /** Get complete wallet information */
  getWalletInfo(walletAddress?: string): Promise<WalletInfo>;

  /** Update wallet information (called by scheduler) */
  updateWalletInfo(walletAddress?: string): Promise<void>;
}
