import { PositionData } from '@schemas/position-data.schema';
import { FinalPositionData, Amount, TokenBreakdown } from '@schemas/final-position.schema';
import { SolanaTrackerPricingService } from '@infrastructure/services/api-pricing/solana-tracker-pricing.service';
import { logger } from '@helpers/logger';

interface RawOperationTotal {
  token_x_usd: number;
  token_y_usd: number;
  total_usd: number;
  total_sol: number;
}

/**
 * Compute USD values and totals for positions in optimized single-pass
 * @param positions - Array of raw position data
 * @returns Array of final position data with totals and net results
 */
export async function computePositions(positions: PositionData[]): Promise<FinalPositionData[]> {
  if (positions.length === 0) return [];

  const pricingService = SolanaTrackerPricingService.getInstance();
  const results: FinalPositionData[] = [];

  for (const position of positions) {
    try {
      const finalPosition = await computeSinglePositionDirect(position, pricingService);
      results.push(finalPosition);
    } catch (error) {
      logger.error(
        `Failed to compute position for pair ${position.meteoraPair.address}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      results.push(createZeroPosition(position));
    }
  }

  return results;
}

/**
 * Helper to add two TokenBreakdown objects
 */
function addTokenBreakdowns(a: TokenBreakdown, b: TokenBreakdown): TokenBreakdown {
  return {
    token_x: { usd: a.token_x.usd + b.token_x.usd, sol: a.token_x.sol + b.token_x.sol },
    token_y: { usd: a.token_y.usd + b.token_y.usd, sol: a.token_y.sol + b.token_y.sol },
    total: { usd: a.total.usd + b.total.usd, sol: a.total.sol + b.total.sol },
  };
}

/**
 * Helper to add two Amount objects
 */
function addAmounts(a: Amount, b: Amount): Amount {
  return { usd: a.usd + b.usd, sol: a.sol + b.sol };
}

/**
 * Aggregate multiple positions into a single position
 * Used when positions are created in multiple transactions but conceptually represent one position
 * @param positions - Array of final position data to aggregate
 * @returns Single aggregated position
 */
export function aggregatePositions(positions: FinalPositionData[]): FinalPositionData {
  if (positions.length === 0) {
    throw new Error('Cannot aggregate zero positions');
  }

  if (positions.length === 1) {
    return positions[0];
  }

  const first = positions[0];

  // Initialize empty totals
  let totalDeposits: TokenBreakdown = { token_x: { usd: 0, sol: 0 }, token_y: { usd: 0, sol: 0 }, total: { usd: 0, sol: 0 } };
  let totalWithdrawals: TokenBreakdown = { token_x: { usd: 0, sol: 0 }, token_y: { usd: 0, sol: 0 }, total: { usd: 0, sol: 0 } };
  let totalClaimFees: TokenBreakdown = { token_x: { usd: 0, sol: 0 }, token_y: { usd: 0, sol: 0 }, total: { usd: 0, sol: 0 } };
  let totalClaimRewards: TokenBreakdown = { token_x: { usd: 0, sol: 0 }, token_y: { usd: 0, sol: 0 }, total: { usd: 0, sol: 0 } };

  // Sum all operations across positions
  for (const position of positions) {
    totalDeposits = addTokenBreakdowns(totalDeposits, position.operations.deposits);
    totalWithdrawals = addTokenBreakdowns(totalWithdrawals, position.operations.withdrawals);
    totalClaimFees = addTokenBreakdowns(totalClaimFees, position.operations.claim_fees);
    totalClaimRewards = addTokenBreakdowns(totalClaimRewards, position.operations.claim_rewards);
  }

  // Calculate aggregated performance metrics
  const invested = totalDeposits.total;
  const gained = addAmounts(totalClaimFees.total, totalClaimRewards.total);
  const withdrawn = totalWithdrawals.total;
  const net_result: Amount = {
    usd: (withdrawn.usd + gained.usd) - invested.usd,
    sol: (withdrawn.sol + gained.sol) - invested.sol,
  };

  const pnl_percentage = invested.sol > 0 ? (net_result.sol / invested.sol) * 100 : 0;

  const aggregatedResult: FinalPositionData = {
    metadata: first.metadata, // Keep metadata from first position
    performance: {
      pnl_percentage,
      tvl: invested,
      invested,
      gained,
      withdrawn,
      net_result,
    },
    operations: {
      deposits: totalDeposits,
      withdrawals: totalWithdrawals,
      claim_fees: totalClaimFees,
      claim_rewards: totalClaimRewards,
    },
  };

  return aggregatedResult;
}

/**
 * Convert raw operation total to clean token breakdown
 */
function rawToTokenBreakdown(raw: RawOperationTotal): TokenBreakdown {
  const usdToSolRatio = raw.total_usd > 0 ? raw.total_sol / raw.total_usd : 0;

  return {
    token_x: {
      usd: raw.token_x_usd,
      sol: raw.token_x_usd * usdToSolRatio
    },
    token_y: {
      usd: raw.token_y_usd,
      sol: raw.token_y_usd * usdToSolRatio
    },
    total: {
      usd: raw.total_usd,
      sol: raw.total_sol
    },
  };
}

/**
 * Compute USD and SOL values and totals for a single position in clean format
 */
async function computeSinglePositionDirect(
  position: PositionData,
  pricingService: SolanaTrackerPricingService,
): Promise<FinalPositionData> {
  const mint_x = position.meteoraPair.mint_x;
  const mint_y = position.meteoraPair.mint_y;
  const duration_hours = calculatePositionDuration(position);

  // Calculate raw totals for each operation type
  const rawDeposits = await computeRawOperationTotal(position.meteoraDeposits, mint_x, mint_y, pricingService);
  const rawClaimRewards = await computeRawOperationTotal(position.meteoraClaimRewards, mint_x, mint_y, pricingService);
  const rawClaimFees = await computeRawOperationTotal(position.meteoraClaimFees, mint_x, mint_y, pricingService);
  const rawWithdrawals = await computeRawOperationTotal(position.meteoraWithdrawals, mint_x, mint_y, pricingService);

  // Convert to clean format
  const deposits = rawToTokenBreakdown(rawDeposits);
  const claim_rewards = rawToTokenBreakdown(rawClaimRewards);
  const claim_fees = rawToTokenBreakdown(rawClaimFees);
  const withdrawals = rawToTokenBreakdown(rawWithdrawals);

  // Calculate totals for performance metrics
  const invested: Amount = { usd: rawDeposits.total_usd, sol: rawDeposits.total_sol };
  const gained: Amount = {
    usd: rawClaimFees.total_usd + rawClaimRewards.total_usd,
    sol: rawClaimFees.total_sol + rawClaimRewards.total_sol
  };
  const withdrawn: Amount = { usd: rawWithdrawals.total_usd, sol: rawWithdrawals.total_sol };

  // Net result: (withdrawn + gained) - invested
  const net_result: Amount = {
    usd: (withdrawn.usd + gained.usd) - invested.usd,
    sol: (withdrawn.sol + gained.sol) - invested.sol,
  };

  const pnl_percentage = invested.sol > 0 ? (net_result.sol / invested.sol) * 100 : 0;

  return {
    metadata: {
      address: position.meteoraPosition.address,
      pair_address: position.meteoraPosition.pair_address,
      owner: position.meteoraPosition.owner,
      pair_name: position.meteoraPair.name,
      mint_x: position.meteoraPair.mint_x,
      mint_y: position.meteoraPair.mint_y,
      duration_hours,
    },
    performance: {
      pnl_percentage,
      tvl: invested,
      invested,
      gained,
      withdrawn,
      net_result,
    },
    operations: {
      deposits,
      withdrawals,
      claim_fees,
      claim_rewards,
    },
  };
}

/**
 * Get token decimals (SOL = 9, others default to 6)
 */
function getTokenDecimals(mint: string): number {
  if (mint === 'So11111111111111111111111111111111111111112') return 9;
  return 6;
}

/**
 * Calculate position duration in hours from first deposit to last activity
 */
function calculatePositionDuration(position: PositionData): number {
  const allTransactions = [
    ...position.meteoraDeposits,
    ...position.meteoraWithdrawals,
    ...position.meteoraClaimFees,
    ...position.meteoraClaimRewards,
  ];

  if (allTransactions.length === 0) {
    return 0;
  }

  const timestamps = allTransactions.map(tx => tx.onchain_timestamp);
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);

  // Convert seconds to hours
  const durationSeconds = lastTimestamp - firstTimestamp;
  const durationHours = durationSeconds / 3600;

  return durationHours;
}

/**
 * Compute USD and SOL totals for a group of transactions
 */
async function computeRawOperationTotal<T extends { token_x_amount: number; token_y_amount: number; onchain_timestamp: number }>(
  transactions: T[],
  mint_x: string,
  mint_y: string,
  pricingService: SolanaTrackerPricingService,
): Promise<RawOperationTotal> {
  let total_x_usd = 0;
  let total_y_usd = 0;
  let total_sol = 0;

  const decimals_x = getTokenDecimals(mint_x);
  const decimals_y = getTokenDecimals(mint_y);
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  for (const tx of transactions) {
    try {
      // Fetch prices sequentially for rate limiting
      const priceX = await pricingService.getHistoricalPrice(mint_x, tx.onchain_timestamp);
      const priceY = await pricingService.getHistoricalPrice(mint_y, tx.onchain_timestamp);

      // Convert raw amounts to human-readable by dividing by decimals
      const amount_x_human = tx.token_x_amount / Math.pow(10, decimals_x);
      const amount_y_human = tx.token_y_amount / Math.pow(10, decimals_y);

      const usd_x = (priceX?.price ?? 0) * amount_x_human;
      const usd_y = (priceY?.price ?? 0) * amount_y_human;

      // Calculate SOL equivalent
      let sol_equivalent = 0;

      if (mint_y === SOL_MINT) {
        // Y token is SOL, use amount_y_human directly
        sol_equivalent = amount_y_human;
        // Add X token converted to SOL via USD (X -> USD -> SOL)
        const sol_price_usd = priceY?.price ?? 0;
        if (sol_price_usd > 0) {
          sol_equivalent += usd_x / sol_price_usd;
        }
      } else if (mint_x === SOL_MINT) {
        // X token is SOL, use amount_x_human directly
        sol_equivalent = amount_x_human;
        // Add Y token converted to SOL via USD (Y -> USD -> SOL)
        const sol_price_usd = priceX?.price ?? 0;
        if (sol_price_usd > 0) {
          sol_equivalent += usd_y / sol_price_usd;
        }
      } else {
        // Neither token is SOL, need to fetch SOL price and convert total USD
        const priceSol = await pricingService.getHistoricalPrice(SOL_MINT, tx.onchain_timestamp);
        const sol_price_usd = priceSol?.price ?? 0;
        if (sol_price_usd > 0) {
          sol_equivalent = (usd_x + usd_y) / sol_price_usd;
        }
      }

      total_x_usd += usd_x;
      total_y_usd += usd_y;
      total_sol += sol_equivalent;
    } catch (error) {
      logger.warn(`Failed to get price for transaction at ${tx.onchain_timestamp}, using 0`);
    }
  }

  const result = {
    token_x_usd: total_x_usd,
    token_y_usd: total_y_usd,
    total_usd: total_x_usd + total_y_usd,
    total_sol: total_sol,
  };

  return result;
}

/**
 * Create a position with zero values for error cases
 */
function createZeroPosition(position: PositionData): FinalPositionData {
  const zeroAmount: Amount = { usd: 0, sol: 0 };
  const zeroTokenBreakdown: TokenBreakdown = {
    token_x: zeroAmount,
    token_y: zeroAmount,
    total: zeroAmount
  };

  return {
    metadata: {
      address: position.meteoraPosition.address,
      pair_address: position.meteoraPosition.pair_address,
      owner: position.meteoraPosition.owner,
      pair_name: position.meteoraPair.name,
      mint_x: position.meteoraPair.mint_x,
      mint_y: position.meteoraPair.mint_y,
      duration_hours: 0,
    },
    performance: {
      pnl_percentage: 0,
      tvl: zeroAmount,
      invested: zeroAmount,
      gained: zeroAmount,
      withdrawn: zeroAmount,
      net_result: zeroAmount,
    },
    operations: {
      deposits: zeroTokenBreakdown,
      withdrawals: zeroTokenBreakdown,
      claim_fees: zeroTokenBreakdown,
      claim_rewards: zeroTokenBreakdown,
    },
  };
}

