import { z } from 'zod';

export const PositionStatusSchema = z.object({
  symbol: z.string(),
  symbolShort: z.string(),
  pnl: z.number(),
  pnlPercentage: z.number(),
  startPrice: z.number(),
  currentPrice: z.number(),
  unclaimedFees: z.number(),
  claimedFees: z.number(),
  wallet: z.string(),
  walletName: z.string(),
  status: z.enum(['profit', 'loss', 'neutral']),
});

export type PositionStatus = z.infer<typeof PositionStatusSchema>;

export const GlobalPositionMessageSchema = z.object({
  guildId: z.string(),
  messageId: z.string(),
  lastUpdated: z.number(),
});

export type GlobalPositionMessage = z.infer<typeof GlobalPositionMessageSchema>;