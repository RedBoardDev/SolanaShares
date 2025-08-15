import type { WalletInfo, WalletPosition } from '@schemas/lpagent.schema';

export interface WalletInfoService {
  /* Get SOL balance for the configured wallet */
  getSolBalance(): Promise<number>;

  /* Get all opening positions from Meteora */
  getPositions(): Promise<WalletPosition[]>;

  /* Calculate total net worth including SOL + positions value + fees */
  getTotalNetWorth(): Promise<number>;

  /* Get complete wallet information */
  getWalletInfo(): Promise<WalletInfo>;

  /* Update wallet information (called by scheduler) */
  updateWalletInfo(): Promise<void>;
}
