import { FinalPositionData } from '@schemas/final-position.schema';

/**
 * Builds a standard short text summary:
 * ⚪ Position closed: 0.00% change (±0.00 SOL)
 * 🟢 Position closed: +X.XX% profit (+Y.YY SOL)
 * 🔴 Position closed: −X.XX% loss (−Y.YY SOL)
 */
export function buildPositionMessage(response: FinalPositionData): string {
  const { pnl_percentage, net_result } = response.performance;

  const icon = pnl_percentage > 0 ? '🟢' : pnl_percentage < 0 ? '🔴' : '⚪';
  const pctLabel = pnl_percentage === 0 ? '0.00% change' : `${pnl_percentage > 0 ? '+' : ''}${pnl_percentage.toFixed(2)}% profit`;
  const solLabel = `(${net_result.sol >= 0 ? '+' : ''}${net_result.sol.toFixed(2)} SOL)`;
  return `${icon} Position closed: ${pctLabel} ${solLabel}`;
}
