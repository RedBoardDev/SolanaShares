import { z } from 'zod';

export const NftFloorPriceSchema = z.object({
  native_currency: z.number(),
  usd: z.number(),
});

export const NftFloorPriceChangeSchema = z.object({
  usd: z.number(),
  native_currency: z.number(),
});

export const NftImageSchema = z.object({
  small: z.string().url(),
  small_2x: z.string().url(),
});

export const NftLinksSchema = z.object({
  homepage: z.string().url().optional(),
  twitter: z.string().url().optional(),
  discord: z.string().url().optional(),
});

export const NftDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  image: NftImageSchema,
  description: z.string(),
  native_currency: z.string(),
  native_currency_symbol: z.string(),
  floor_price: NftFloorPriceSchema,
  floor_price_24h_percentage_change: NftFloorPriceChangeSchema,
  volume_24h: z.object({
    native_currency: z.number(),
    usd: z.number(),
  }),
  total_supply: z.number(),
  one_day_sales: z.number(),
  links: NftLinksSchema.optional(),
});

export type NftData = z.infer<typeof NftDataSchema>;
export type NftFloorPrice = z.infer<typeof NftFloorPriceSchema>;
export type NftFloorPriceChange = z.infer<typeof NftFloorPriceChangeSchema>;

export const CachedNftDataSchema = z.object({
  data: NftDataSchema,
  timestamp: z.number(),
  lastUpdated: z.string(),
});

export type CachedNftData = z.infer<typeof CachedNftDataSchema>;