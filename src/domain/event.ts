export type Event =
  | { timestamp: string; type: 'deposit'; user: string; amount: number; shares: number }
  | { timestamp: string; type: 'withdraw'; user: string; amount: number; shares: number }
  | { timestamp: string; type: 'openPosition'; beforeBalance: number; addedLiquidity: number }
  | { timestamp: string; type: 'closePosition'; afterBalance: number; pnl: number };
