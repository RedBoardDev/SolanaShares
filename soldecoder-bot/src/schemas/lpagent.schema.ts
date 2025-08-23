import { z } from 'zod';

/** PnL data in LpAgent response, only valueNative. */
export const LpAgentPnlSchema = z.object({
  valueNative: z.number(),
}).strip();

/** Token info in a position, with optional logo. */
export const LpAgentTokenInfoSchema = z.object({
  token_symbol: z.string(),
  token_name: z.string(),
  token_decimals: z.number(),
  token_address: z.string(),
  logo: z.string().url().nullable().optional(),
});

/** Pool info: fee and tick spacing. */
export const LpAgentPoolInfoSchema = z.object({
  fee: z.number(),
  tickSpacing: z.number(),
});

/** Current position amounts, raw and adjusted. */
export const LpAgentCurrentPositionSchema = z.object({
  amount0: z.string(),
  amount1: z.string(),
  amount0Adjusted: z.number(),
  amount1Adjusted: z.number(),
});

/** Single position from LpAgent API, only used fields. */
export const LpAgentPositionSchema = z.object({
  status: z.string(),
  token0: z.string(),
  token1: z.string(),
  pool: z.string(),
  pairName: z.string(),
  currentValue: z.string(),
  inRange: z.boolean(),
  pnl: LpAgentPnlSchema,
  valueNative: z.number(),
}).strip();

/** LpAgent API response: status, count, data. */
export const LpAgentResponseSchema = z.object({
  status: z.string(),
  count: z.number(),
  data: z.array(LpAgentPositionSchema),
});

/** Simplified wallet position, only needed fields. */
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

/** Wallet info: SOL balance, positions, net worth, last update. */
export const WalletInfoSchema = z.object({
  solBalance: z.number(),
  positions: z.array(WalletPositionSchema),
  totalNetWorth: z.number(),
  lastUpdated: z.number(),
});

/** Type for PnL data. */
export type LpAgentPnl = z.infer<typeof LpAgentPnlSchema>;
/** Type for token info. */
export type LpAgentTokenInfo = z.infer<typeof LpAgentTokenInfoSchema>;
/** Type for pool info. */
export type LpAgentPoolInfo = z.infer<typeof LpAgentPoolInfoSchema>;
/** Type for current position amounts. */
export type LpAgentCurrentPosition = z.infer<typeof LpAgentCurrentPositionSchema>;
/** Type for a single position. */
export type LpAgentPosition = z.infer<typeof LpAgentPositionSchema>;
/** Type for LpAgent API response. */
export type LpAgentResponse = z.infer<typeof LpAgentResponseSchema>;
/** Type for wallet position. */
export type WalletPosition = z.infer<typeof WalletPositionSchema>;

/** Overview data from LpAgent API, aggregated stats. */
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
}).strip();

/** LpAgent overview API response: status and data. */
export const LpAgentOverviewResponseSchema = z.object({
  status: z.string(),
  data: LpAgentOverviewDataSchema,
}).strip();

/** Pagination info for historical positions. */
export const LpAgentPaginationSchema = z.object({
  currentPage: z.number(),
  totalPages: z.number(),
  totalCount: z.number(),
  pageSize: z.number(),
});

/** Extended position schema for historical positions with additional fields. */
export const LpAgentHistoricalPositionSchema = z.object({
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
  pnl: z.object({
    value: z.number(),
    valueNative: z.number(),
    percent: z.number(),
    percentNative: z.number(),
  }),
  pnlNative: z.number(),
  upnl: z.null().optional(),
  owner: z.string(),
  dpr: z.number(),
  dprNative: z.number(),
  ageHour: z.string(),
  decimal0: z.number(),
  decimal1: z.number(),
  yield24h: z.null().optional(),
  apr: z.null().optional(),
  protocol: z.string(),
  token0Info: LpAgentTokenInfoSchema,
  token1Info: LpAgentTokenInfoSchema,
  poolInfo: LpAgentPoolInfoSchema,
  age: z.string(),
  position: z.string(),
  logo0: z.string().url(),
  logo1: z.string().url(),
  tokenName0: z.string(),
  tokenName1: z.string(),
  priceRange: z.tuple([z.number(), z.number(), z.number()]),
  value: z.number(),
  valueNative: z.number(),
  close_At: z.string().optional(),
  closeAt: z.string(),
  fee: z.number(),
  feeNative: z.number(),
  feePercent: z.number(),
  feePercentNative: z.number(),
}).strip();

/** Historical positions data container with pagination. */
export const LpAgentHistoricalDataSchema = z.object({
  data: z.array(LpAgentHistoricalPositionSchema),
  pagination: LpAgentPaginationSchema,
});

/** Complete historical positions API response. */
export const LpAgentHistoricalResponseSchema = z.object({
  status: z.string(),
  count: z.number(),
  data: LpAgentHistoricalDataSchema,
});

export type WalletInfo = z.infer<typeof WalletInfoSchema>;
export type LpAgentOverviewData = z.infer<typeof LpAgentOverviewDataSchema>;
export type LpAgentOverviewResponse = z.infer<typeof LpAgentOverviewResponseSchema>;
export type LpAgentPagination = z.infer<typeof LpAgentPaginationSchema>;
export type LpAgentHistoricalPosition = z.infer<typeof LpAgentHistoricalPositionSchema>;
export type LpAgentHistoricalData = z.infer<typeof LpAgentHistoricalDataSchema>;
export type LpAgentHistoricalResponse = z.infer<typeof LpAgentHistoricalResponseSchema>;
