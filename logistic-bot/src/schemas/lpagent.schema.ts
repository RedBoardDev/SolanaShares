import { z } from 'zod';

// Schema for PnL data in LpAgent response
export const LpAgentPnlSchema = z.object({
  value: z.number(),
  percent: z.number(),
  valueNative: z.number(),
  percentNative: z.number(),
});

// Schema for token info in position
export const LpAgentTokenInfoSchema = z.object({
  token_symbol: z.string(),
  token_name: z.string(),
  token_decimals: z.number(),
  token_address: z.string(),
  logo: z.string().url().nullable().optional(), // Can be null or undefined
});

// Schema for pool info
export const LpAgentPoolInfoSchema = z.object({
  fee: z.number(),
  tickSpacing: z.number(),
});

// Schema for current position amounts
export const LpAgentCurrentPositionSchema = z.object({
  amount0: z.string(),
  amount1: z.string(),
  amount0Adjusted: z.number(),
  amount1Adjusted: z.number(),
});

// Schema for a single position from LpAgent API
export const LpAgentPositionSchema = z.object({
  status: z.string(),
  strategyType: z.string(),
  tokenId: z.string(),
  pairName: z.string(),
  currentValue: z.string(),
  inputValue: z.number(),
  inputNative: z.number(),
  outputValue: z.number(),
  outputNative: z.number(),
  collectedReward: z.number(),
  collectedRewardNative: z.number(),
  collectedFee: z.number(),
  collectedFeeNative: z.number(),
  uncollectedFee: z.string(),
  tickLower: z.number(),
  tickUpper: z.number(),
  pool: z.string(),
  liquidity: z.string(),
  token0: z.string(),
  token1: z.string(),
  inRange: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pnl: LpAgentPnlSchema,
  pnlNative: z.number(),
  upnl: z.null(),
  owner: z.string(),
  dpr: z.number(),
  dprNative: z.number(),
  ageHour: z.null(),
  decimal0: z.number(),
  decimal1: z.number(),
  yield24h: z.null(),
  apr: z.null(),
  protocol: z.string(),
  token0Info: LpAgentTokenInfoSchema,
  token1Info: LpAgentTokenInfoSchema,
  poolInfo: LpAgentPoolInfoSchema,
  age: z.string(),
  position: z.string(),
  logo0: z.string().url().nullable().optional(), // Can be null or undefined
  logo1: z.string().url().nullable().optional(), // Can be null or undefined
  tokenName0: z.string(),
  tokenName1: z.string(),
  priceRange: z.array(z.number()),
  range: z.array(z.number()),
  value: z.number(),
  valueNative: z.number(),
  current: LpAgentCurrentPositionSchema,
  unCollectedFee0: z.number(),
  unCollectedFee1: z.number(),
  unCollectedFee: z.number(),
  unCollectedFeeNative: z.number(),
  price0: z.number(),
  price1: z.number(),
  id: z.string(),
  logs: z.array(z.unknown()).optional(), // Can be undefined
});

// Schema for LpAgent API response
export const LpAgentResponseSchema = z.object({
  status: z.string(),
  count: z.number(),
  data: z.array(LpAgentPositionSchema),
});

// Simplified position schema for our wallet service (only the data we need)
export const WalletPositionSchema = z.object({
  status: z.string(),
  token0: z.string(),
  token1: z.string(),
  pool: z.string(),
  pairName: z.string(),
  currentValue: z.string(),
  inRange: z.boolean(),
  pnl: LpAgentPnlSchema,
  valueNative: z.number(),
});

// Schema for wallet info data
export const WalletInfoSchema = z.object({
  solBalance: z.number(),
  positions: z.array(WalletPositionSchema),
  totalNetWorth: z.number(),
  lastUpdated: z.number(), // timestamp
});

// Export types
export type LpAgentPnl = z.infer<typeof LpAgentPnlSchema>;
export type LpAgentTokenInfo = z.infer<typeof LpAgentTokenInfoSchema>;
export type LpAgentPoolInfo = z.infer<typeof LpAgentPoolInfoSchema>;
export type LpAgentCurrentPosition = z.infer<typeof LpAgentCurrentPositionSchema>;
export type LpAgentPosition = z.infer<typeof LpAgentPositionSchema>;
export type LpAgentResponse = z.infer<typeof LpAgentResponseSchema>;
export type WalletPosition = z.infer<typeof WalletPositionSchema>;
// Schema for overview data from LpAgent API
export const LpAgentOverviewDataSchema = z.object({
  owner: z.string(),
  chain: z.string(),
  protocol: z.string(),
  total_inflow: z.number(),
  avg_inflow: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  total_outflow: z.number(),
  total_fee: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  total_reward: z.number(),
  total_pnl: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  total_inflow_native: z.number(),
  avg_inflow_native: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  total_outflow_native: z.number(),
  total_fee_native: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  total_reward_native: z.number(),
  total_pnl_native: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  avg_age_hour: z.number(),
  total_lp: z.string(),
  win_lp: z.string(),
  win_lp_native: z.string(),
  closed_lp: z.object({
    ALL: z.string(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  opening_lp: z.string(),
  total_pool: z.string(),
  win_rate: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  win_rate_native: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  expected_value: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  expected_value_native: z.object({
    ALL: z.number(),
    '7D': z.number(),
    '1M': z.number(),
    '3M': z.number(),
    '1Y': z.number(),
    YTD: z.number(),
  }),
  fee_percent: z.number(),
  fee_percent_native: z.number(),
  apr: z.number(),
  roi: z.number(),
  roi_avg_inflow: z.number(),
  roi_avg_inflow_native: z.number(),
  first_activity: z.string(),
  last_activity: z.string(),
  avg_pos_profit: z.number(),
  avg_pos_profit_native: z.number(),
  avg_monthly_profit_percent: z.number(),
  avg_monthly_pnl: z.number(),
  avg_monthly_inflow: z.number(),
  avg_monthly_profit_percent_native: z.number(),
  avg_monthly_pnl_native: z.number(),
  avg_monthly_inflow_native: z.number(),
  updated_at: z.string(),
});

// Schema for overview response
export const LpAgentOverviewResponseSchema = z.object({
  status: z.string(),
  data: LpAgentOverviewDataSchema,
});

export type WalletInfo = z.infer<typeof WalletInfoSchema>;
export type LpAgentOverviewData = z.infer<typeof LpAgentOverviewDataSchema>;
export type LpAgentOverviewResponse = z.infer<typeof LpAgentOverviewResponseSchema>;