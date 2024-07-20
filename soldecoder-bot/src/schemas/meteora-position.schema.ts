import { z } from 'zod';

export const MeteoraPositionSchema = z.object({
address: z.string(),
  pair_address: z.string(),
  owner: z.string(),
  total_fee_x_claimed: z.number(),
  total_fee_y_claimed: z.number(),
  total_reward_x_claimed: z.number(),
  total_reward_y_claimed: z.number(),
  total_fee_usd_claimed: z.number(),
  total_reward_usd_claimed: z.number(),
  fee_apy_24h: z.number(),
  fee_apr_24h: z.number(),
  daily_fee_yield: z.number(),
});

export type MeteoraPosition = z.infer<typeof MeteoraPositionSchema>;

export const MeteoraDepositSchema = z.object({
    tx_id: z.string(),
    position_address: z.string(),
    pair_address: z.string(),
    active_bin_id: z.number(),
    token_x_amount: z.number(),
    token_y_amount: z.number(),
    price: z.number(),
    token_x_usd_amount: z.number(),
    token_y_usd_amount: z.number(),
    onchain_timestamp: z.number(),
});

export type MeteoraDeposit = z.infer<typeof MeteoraDepositSchema>;

export const MeteoraClaimRewardSchema = z.object({
    tx_id: z.string(),
    position_address: z.string(),
    pair_address: z.string(),
    token_x_amount: z.number(),
    token_y_amount: z.number(),
    token_x_usd_amount: z.number(),
    token_y_usd_amount: z.number(),
    onchain_timestamp: z.number(),
});

export type MeteoraClaimReward = z.infer<typeof MeteoraClaimRewardSchema>;

export const MeteoraClaimFeeSchema = z.object({
    tx_id: z.string(),
    position_address: z.string(),
    pair_address: z.string(),
    token_x_amount: z.number(),
    token_y_amount: z.number(),
    token_x_usd_amount: z.number(),
    token_y_usd_amount: z.number(),
    onchain_timestamp: z.number(),
});

export type MeteoraClaimFee = z.infer<typeof MeteoraClaimFeeSchema>;

export const MeteoraWithdrawalSchema = z.object({
    tx_id: z.string(),
    position_address: z.string(),
    pair_address: z.string(),
    active_bin_id: z.number(),
    token_x_amount: z.number(),
    token_y_amount: z.number(),
    price: z.number(),
    token_x_usd_amount: z.number(),
    token_y_usd_amount: z.number(),
    onchain_timestamp: z.number(),
});

export type MeteoraWithdrawal = z.infer<typeof MeteoraWithdrawalSchema>;
