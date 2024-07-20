import { z } from 'zod';

export const MeteoraPairFeesSchema = z.object({
    min_30: z.number(),
    hour_1: z.number(),
    hour_2: z.number(),
    hour_4: z.number(),
    hour_12: z.number(),
    hour_24: z.number(),
});

export const MeteoraPairFeeTvlRatioSchema = z.object({
    min_30: z.number(),
    hour_1: z.number(),
    hour_2: z.number(),
    hour_4: z.number(),
    hour_12: z.number(),
    hour_24: z.number(),
});

export const MeteoraPairVolumeSchema = z.object({
    min_30: z.number(),
    hour_1: z.number(),
    hour_2: z.number(),
    hour_4: z.number(),
    hour_12: z.number(),
    hour_24: z.number(),
});

export const MeteoraPairSchema = z.object({
    address: z.string(),
    name: z.string(),
    mint_x: z.string(),
    mint_y: z.string(),
    reserve_x: z.string(),
    reserve_y: z.string(),
    reserve_x_amount: z.number(),
    reserve_y_amount: z.number(),
    bin_step: z.number(),
    base_fee_percentage: z.string(),
    max_fee_percentage: z.string(),
    protocol_fee_percentage: z.string(),
    liquidity: z.string(),
    reward_mint_x: z.string(),
    reward_mint_y: z.string(),
    fees_24h: z.number(),
    today_fees: z.number(),
    trade_volume_24h: z.number(),
    cumulative_trade_volume: z.string(),
    cumulative_fee_volume: z.string(),
    current_price: z.number(),
    apr: z.number(),
    apy: z.number(),
    farm_apr: z.number(),
    farm_apy: z.number(),
    hide: z.boolean(),
    is_blacklisted: z.boolean(),
    fees: MeteoraPairFeesSchema,
    fee_tvl_ratio: MeteoraPairFeeTvlRatioSchema,
    volume: MeteoraPairVolumeSchema,
    tags: z.array(z.string()),
    launchpad: z.null(),
    is_verified: z.boolean(),
});

export type MeteoraPair = z.infer<typeof MeteoraPairSchema>;