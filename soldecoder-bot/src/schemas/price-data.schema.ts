import { z } from 'zod';

// Schema for historical price API (/price/history/timestamp)
export const PriceDataSchema = z.object({
  timestamp: z.number(),
  price: z.number().nullable(),
  closest_timestamp: z.number().nullable(),
  closest_timestamp_unix: z.number().optional(),
  pool: z.string().nullable(),
}).transform((data, ctx) => {
  if (data.price === null || data.closest_timestamp === null || data.pool === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Historical price data not available (null values returned)',
    });
    return z.NEVER;
  }

  return {
    timestamp: data.timestamp,
    price: data.price,
    closest_timestamp: data.closest_timestamp,
    closest_timestamp_unix: data.closest_timestamp_unix || data.timestamp,
    pool: data.pool,
  };
});

export type PriceData = z.infer<typeof PriceDataSchema>;

// Schema for current price API (/price)
export const CurrentPriceDataSchema = z.object({
  price: z.number(),
  priceQuote: z.number(),
  liquidity: z.number(),
  marketCap: z.number(),
  lastUpdated: z.number(),
});

export type CurrentPriceData = z.infer<typeof CurrentPriceDataSchema>;

export const PriceResponseSchema = PriceDataSchema;
