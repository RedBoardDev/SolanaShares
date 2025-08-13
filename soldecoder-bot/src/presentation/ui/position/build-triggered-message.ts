import type { FinalPositionData } from '@schemas/final-position.schema';
import type { TriggerData } from '@schemas/trigger-message.schema';

/**
 * Builds a triggered message for either take-profit or stop-loss events
 * E.g. "🎯 Take profit triggered: +15.50% profit (+2.34 SOL)"
 * E.g. "🛑 Stop loss triggered: -8.25% loss (-1.12 SOL)"
 */
export function buildTriggeredMessage(response: FinalPositionData, trigger: TriggerData): string {
  const { pnl_percentage, net_result } = response.performance;
  const solLabel = `(${net_result.sol >= 0 ? '+' : ''}${net_result.sol.toFixed(2)} SOL)`;

  if (trigger.type === 'take_profit') {
    const icon = '🎯';
    const label = `${pnl_percentage.toFixed(2)}% profit`;
    return `${icon} Take profit triggered: +${label} ${solLabel}`;
  } else {
    const icon = '🛑';
    const label = `${Math.abs(pnl_percentage).toFixed(2)}% loss`;
    return `${icon} Stop loss triggered: -${label} ${solLabel}`;
  }
}
