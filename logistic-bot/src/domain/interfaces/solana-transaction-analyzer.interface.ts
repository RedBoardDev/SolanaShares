export interface ParticipantTransaction {
  signature: string;
  amount: number; // Amount in SOL (positive = deposit, negative = withdrawal)
  timestamp: number; // Unix timestamp
  slot?: number; // Solana slot number
  senderAddress?: string; // Address of counterparty
}

export interface SolanaTransactionAnalyzer {
  /* Get recent transaction signatures for a wallet */
  getRecentTransactions(walletAddress: string, limit?: number): Promise<string[]>;

  /* Get all transaction signatures for a wallet with optional pagination */
  getAllTransactions(walletAddress: string, before?: string, limit?: number): Promise<string[]>;

  /* Analyze a specific transaction and extract deposit information */
  analyzeTransaction(signature: string, targetWalletAddress: string): Promise<ParticipantTransaction | null>;

  /* Analyze all transactions for a wallet and return deposit transactions */
  analyzeAllTransactions(walletAddress: string): Promise<ParticipantTransaction[]>;

  /* Get new transactions since a specific signature/timestamp */
  getNewTransactionsSince(walletAddress: string, lastSignature?: string, lastTimestamp?: number): Promise<string[]>;

  /* Get new transactions from main wallet since checkpoint */
  getNewTransactionsSinceFromMainWallet(lastSignature?: string, lastTimestamp?: number): Promise<string[]>;

  /* Analyze transaction specifically for a user wallet (filtering from main wallet transactions) */
  analyzeTransactionForUserWallet(signature: string, userWalletAddress: string): Promise<ParticipantTransaction | null>;

  /* Get transactions between main wallet and specific user wallet */
  getTransactionsBetweenWallets(userWalletAddress: string, lastSignature?: string, lastTimestamp?: number): Promise<string[]>;
}
