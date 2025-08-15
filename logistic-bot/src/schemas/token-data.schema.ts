import { z } from 'zod';

// Schema for token price data from CoinGecko API
export const TokenPriceSchema = z.object({
  usd: z.number().optional(),
  usd_24h_vol: z.number().optional(),
  usd_24h_change: z.number().optional(),
  usd_market_cap: z.number().optional(),
  last_updated_at: z.number().optional(),
});

// Schema for multiple tokens response
export const TokensPriceResponseSchema = z.record(z.string(), TokenPriceSchema);

// Schema for single token data
export const TokenDataSchema = z.object({
  usd: z.number().optional(),
  usd_24h_vol: z.number().optional(),
  usd_24h_change: z.number().optional(),
  usd_market_cap: z.number().optional(),
  last_updated_at: z.number().optional(),
});

export type TokenData = z.infer<typeof TokenDataSchema>;
export type TokenPrice = z.infer<typeof TokenPriceSchema>;
export type TokensPriceResponse = z.infer<typeof TokensPriceResponseSchema>;

// Schema for cached token data with timestamp
export const CachedTokenDataSchema = z.object({
  data: TokenDataSchema,
  timestamp: z.number(),
  lastUpdated: z.string(), // ISO string for display
});

export type CachedTokenData = z.infer<typeof CachedTokenDataSchema>;