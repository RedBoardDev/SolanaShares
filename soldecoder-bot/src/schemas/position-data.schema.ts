import { z } from 'zod';
import { MeteoraClaimFeeSchema, MeteoraClaimRewardSchema, MeteoraDepositSchema, MeteoraPositionSchema, MeteoraWithdrawalSchema } from '@schemas/meteora-position.schema';
import { MeteoraPairSchema } from '@schemas/meteora-pair.schema';

export const PositionDataSchema = z.object({
  meteoraPosition: MeteoraPositionSchema,
  meteoraDeposits: MeteoraDepositSchema.array(),
  meteoraClaimRewards: MeteoraClaimRewardSchema.array(),
  meteoraClaimFees: MeteoraClaimFeeSchema.array(),
  meteoraWithdrawals: MeteoraWithdrawalSchema.array(),
  meteoraPair: MeteoraPairSchema,
});

export type PositionData = z.infer<typeof PositionDataSchema>;
