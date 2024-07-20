import { z } from 'zod';

/**
 * Schema for take profit trigger data
 */
export const TakeProfitTriggerSchema = z.object({
  profitPct: z.number().min(0, 'Profit percentage must be non-negative'),
  thresholdPct: z.number().min(0, 'Threshold percentage must be non-negative'),
});

/**
 * Schema for stop loss trigger data
 */
export const StopLossTriggerSchema = z.object({
  lossPct: z.number().min(0, 'Loss percentage must be non-negative'),
  thresholdPct: z.number().min(0, 'Threshold percentage must be non-negative'),
});

export type TakeProfitTrigger = z.infer<typeof TakeProfitTriggerSchema>;
export type StopLossTrigger = z.infer<typeof StopLossTriggerSchema>;

export type TriggerData =
  | { type: 'take_profit'; data: TakeProfitTrigger }
  | { type: 'stop_loss'; data: StopLossTrigger };
