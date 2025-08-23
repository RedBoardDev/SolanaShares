import type { PositionStatus } from '@schemas/position-status.schema';
import { EmbedBuilder } from 'discord.js';

export function buildGlobalPositionEmbed(
	positionsByWallet: Map<string, PositionStatus[]>,
	options?: { percentOnly?: boolean; footerText?: string, updateId?: string },
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setTitle("📊 Position overview")
		.setColor(0x5865f2)
		.setTimestamp()
		.setFooter({
			text:
				(options?.footerText ?? "Every 1 minute - ") +
				(options?.updateId ? options.updateId : "")
		});

  if (positionsByWallet.size === 0) {
    embed.setDescription('No active positions found in followed channels.');
    return embed;
  }

  const percentOnly = options?.percentOnly === true;
  let totalPositions = 0;
  let totalPnL = 0;

  for (const [walletName, positions] of positionsByWallet) {
    totalPositions += positions.length;

    const walletField = positions
      .map((pos) => {
        totalPnL += pos.pnl;
        const icon = getStatusIcon(pos.status);

        if (percentOnly) {
          // Show full view but mask amounts with asterisks
          const pnlText = formatPnLPercentOnly(pos.pnl, pos.pnlPercentage);
          const priceText = 'From ••• → •••';
          const totalFees = pos.unclaimedFees + pos.claimedFees;
          const feesPercentage = pos.startPrice > 0 ? (totalFees / pos.startPrice) * 100 : 0;
          const feesText = `Fees: ••• (${feesPercentage.toFixed(2)}%)`;
          return `${icon} ${pos.symbolShort} ${pnlText}\n└ ${priceText} | ${feesText}`;
        }

        const pnlText = formatPnL(pos.pnl, pos.pnlPercentage);
        const priceText = `From ${pos.startPrice.toFixed(2)} → ${pos.currentPrice.toFixed(2)}`;
        const totalFees = pos.unclaimedFees + pos.claimedFees;
        const feesPercentage = pos.startPrice > 0 ? (totalFees / pos.startPrice) * 100 : 0;
        const feesText = `Fees: ${totalFees.toFixed(2)} (${feesPercentage.toFixed(2)}%)`;
        return `${icon} ${pos.symbolShort} ${pnlText}\n└ ${priceText} | ${feesText}`;
      })
      .join('\n');

    embed.addFields({
      name: `👤 ${walletName}`,
      value: walletField,
      inline: false,
    });
  }

  const summaryIcon = totalPnL > 0 ? '🟢' : totalPnL < 0 ? '🔴' : '⚪';
  const positionsLine = `${summaryIcon} **${totalPositions} position${totalPositions !== 1 ? 's' : ''}**`;

  const avgPnL = totalPositions > 0 ? totalPnL / totalPositions : 0;
  const totalPnLSign = totalPnL >= 0 ? '+' : '';
  const avgPnLSign = avgPnL >= 0 ? '+' : '';

  const solAmount = percentOnly ? '•••' : `${totalPnL.toFixed(2)}`;
  const pnlLine = `└ Total PnL: ${totalPnLSign}${solAmount} SOL (**${avgPnLSign}${avgPnL.toFixed(2)}%**)`;

  const summaryText = `${positionsLine}\n${pnlLine}`;

  embed.setDescription(summaryText);

  return embed;
}

function getStatusIcon(status: 'profit' | 'loss' | 'neutral'): string {
  switch (status) {
    case 'profit':
      return '🟢';
    case 'loss':
      return '🔴';
    case 'neutral':
      return '⚪';
    default:
      return '⚪';
  }
}

function formatPnL(pnl: number, percentage: number): string {
  const sign = pnl >= 0 ? '+' : '';
  const pnlText = `${sign}${pnl.toFixed(2)} SOL`;
  const percentageText = `(**${sign}${percentage.toFixed(2)}%**)`;
  return `${pnlText} ${percentageText}`;
}

function formatPnLPercentOnly(pnl: number, percentage: number): string {
  const sign = pnl >= 0 ? '+' : '';
  const pnlText = `${sign}••• SOL`;
  const percentageText = `(**${sign}${percentage.toFixed(2)}%**)`;
  return `${pnlText} ${percentageText}`;
}
