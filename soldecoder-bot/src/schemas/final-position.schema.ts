import { z } from 'zod';

/**
 * Amount in USD and SOL.
 */
export const AmountSchema = z.object({
  usd: z.number(),
  sol: z.number(),
});

/**
 * Token breakdown for x, y, and total.
 */
export const TokenBreakdownSchema = z.object({
  token_x: AmountSchema,
  token_y: AmountSchema,
  total: AmountSchema,
});

/**
 * Metadata for a position.
 */
export const PositionMetadataSchema = z.object({
  address: z.string(),
  pair_address: z.string(),
  owner: z.string(),
  pair_name: z.string(),
  mint_x: z.string(),
  mint_y: z.string(),
  duration_hours: z.number(),
});

/**
 * Performance metrics for a position.
 */
export const PerformanceMetricsSchema = z.object({
  pnl_percentage: z.number(), // PnL in SOL percent
  tvl: AmountSchema, // TVL in USD and SOL
  invested: AmountSchema, // Total deposited
  gained: AmountSchema, // Fees + rewards
  withdrawn: AmountSchema, // Total withdrawn
  net_result: AmountSchema, // Final PnL
});

/**
 * Operation details for a position.
 */
export const OperationDetailsSchema = z.object({
  deposits: TokenBreakdownSchema,
  withdrawals: TokenBreakdownSchema,
  claim_fees: TokenBreakdownSchema,
  claim_rewards: TokenBreakdownSchema,
});

/**
 * Main schema for a final position.
 */
export const FinalPositionDataSchema = z.object({
  metadata: PositionMetadataSchema,
  performance: PerformanceMetricsSchema,
  operations: OperationDetailsSchema,
});

/**
 * Amount type.
 */
export type Amount = z.infer<typeof AmountSchema>;
/**
 * Token breakdown type.
 */
export type TokenBreakdown = z.infer<typeof TokenBreakdownSchema>;
/**
 * Position metadata type.
 */
export type PositionMetadata = z.infer<typeof PositionMetadataSchema>;
/**
 * Performance metrics type.
 */
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
/**
 * Operation details type.
 */
export type OperationDetails = z.infer<typeof OperationDetailsSchema>;

export type FinalPositionData = z.infer<typeof FinalPositionDataSchema>;
