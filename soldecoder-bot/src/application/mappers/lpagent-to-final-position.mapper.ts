import type { LpAgentHistoricalPosition } from '@schemas/lpagent.schema';
import type { FinalPositionData } from '@schemas/final-position.schema';

/**
 * Maps LpAgent historical position data to FinalPositionData format
 * Used for converting LpAgent API responses to our internal position format
 */
export function mapLpAgentToFinalPosition(lpPosition: LpAgentHistoricalPosition): FinalPositionData {
  // Parse duration from string to number (hours)
  const durationHours = parseFloat(lpPosition.ageHour) || 0;

  // Calculate gained amounts (fees + rewards)
  const gainedUsd = lpPosition.collectedFee + lpPosition.collectedReward;
  const gainedSol = lpPosition.collectedFeeNative + lpPosition.collectedRewardNative;

  return {
    metadata: {
      address: lpPosition.position,
      pair_address: lpPosition.pool,
      owner: lpPosition.owner,
      pair_name: `${lpPosition.token0Info.token_symbol}-${lpPosition.token1Info.token_symbol}`,
      mint_x: lpPosition.token0,
      mint_y: lpPosition.token1,
      duration_hours: durationHours,
    },
    performance: {
      pnl_percentage: lpPosition.pnl.percentNative,
      tvl: {
        usd: lpPosition.value,
        sol: lpPosition.valueNative,
      },
      invested: {
        usd: lpPosition.inputValue,
        sol: lpPosition.inputNative,
      },
      gained: {
        usd: gainedUsd,
        sol: gainedSol,
      },
      withdrawn: {
        usd: lpPosition.outputValue,
        sol: lpPosition.outputNative,
      },
      net_result: {
        usd: lpPosition.pnl.value,
        sol: lpPosition.pnl.valueNative,
      },
    },
    operations: {
      deposits: {
        token_x: {
          usd: lpPosition.inputValue / 2, // Approximate split for deposits
          sol: lpPosition.inputNative / 2,
        },
        token_y: {
          usd: lpPosition.inputValue / 2,
          sol: lpPosition.inputNative / 2,
        },
        total: {
          usd: lpPosition.inputValue,
          sol: lpPosition.inputNative,
        },
      },
      withdrawals: {
        token_x: {
          usd: lpPosition.outputValue / 2, // Approximate split for withdrawals
          sol: lpPosition.outputNative / 2,
        },
        token_y: {
          usd: lpPosition.outputValue / 2,
          sol: lpPosition.outputNative / 2,
        },
        total: {
          usd: lpPosition.outputValue,
          sol: lpPosition.outputNative,
        },
      },
      claim_fees: {
        token_x: {
          usd: lpPosition.collectedFee / 2, // Approximate split for fees
          sol: lpPosition.collectedFeeNative / 2,
        },
        token_y: {
          usd: lpPosition.collectedFee / 2,
          sol: lpPosition.collectedFeeNative / 2,
        },
        total: {
          usd: lpPosition.collectedFee,
          sol: lpPosition.collectedFeeNative,
        },
      },
      claim_rewards: {
        token_x: {
          usd: lpPosition.collectedReward / 2, // Approximate split for rewards
          sol: lpPosition.collectedRewardNative / 2,
        },
        token_y: {
          usd: lpPosition.collectedReward / 2,
          sol: lpPosition.collectedRewardNative / 2,
        },
        total: {
          usd: lpPosition.collectedReward,
          sol: lpPosition.collectedRewardNative,
        },
      },
    },
  };
}
