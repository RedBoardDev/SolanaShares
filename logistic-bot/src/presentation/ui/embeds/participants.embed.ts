import { EmbedBuilder } from 'discord.js';
import type { ParticipantEntity } from '@domain/entities/participant.entity';
import { config } from '@infrastructure/config/env';
import { WalletSchedulerService } from '@infrastructure/services/wallet-scheduler.service';

export interface ParticipantsOverviewData {
  totalParticipants: number;
  activeParticipants: number;
  totalInvested: number;
  totalNetWorth?: number;
  dailyRoi?: number;
  lastUpdated?: number;
}

export interface ParticipantDisplayInfo {
  discordUserId: string;
  walletAddress: string;
  shortWallet: string;
  investedAmount: number;
  statusIcon: string; // ✅, ❌, or ⚠️
  sharePercentage: number;
  currentValue?: number;
  pnlAmount?: number;
  pnlPercentage?: number;
}

// Utility functions for formatting
function formatSol(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value.toFixed(4)} SOL`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}

export function calculateDailyRoi(totalInvested: number, totalNetWorth?: number): number | undefined {
  if (!totalNetWorth || totalInvested <= 0) return undefined;

  try {
    const startDate = new Date(config.solana.phase.startDate);
    const now = new Date();
    const daysSinceStart = Math.max(1, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const totalGain = totalNetWorth - totalInvested;
    return (totalGain / totalInvested / daysSinceStart) * 100;
  } catch {
    return undefined;
  }
}

export function generateParticipantsOverviewEmbed(data: ParticipantsOverviewData): EmbedBuilder {
  const { totalParticipants, activeParticipants, totalInvested, totalNetWorth, dailyRoi, lastUpdated } = data;

  const activePercentage = totalParticipants > 0
    ? ((activeParticipants / totalParticipants) * 100).toFixed(1)
    : '0.0';

  const embed = new EmbedBuilder()
    .setColor(0x9945ff)
    .setTitle('💎 Investment Participant Dashboard');

  // First row: Active Participants and Total Pool
  embed.addFields(
    {
      name: '📈 Active Participants',
      value: `${activeParticipants}/${totalParticipants} investors\n(${activePercentage}%)`,
      inline: true,
    },
    {
      name: '💰 Total Pool',
      value: formatSol(totalInvested),
      inline: true,
    },
    {
      name: '\u200b', // Empty field to force new line
      value: '\u200b',
      inline: true,
    }
  );

  // Second row: Daily ROI and Total Net Worth
  if (dailyRoi !== undefined) {
    const roiEmoji = dailyRoi >= 0 ? '📈' : '📉';
    const sign = dailyRoi >= 0 ? '+' : '';
    embed.addFields({
      name: `${roiEmoji} Daily ROI`,
      value: `**${sign}${dailyRoi.toFixed(2)}%**`,
      inline: true,
    });
  } else {
    embed.addFields({
      name: '📈 Daily ROI',
      value: '—',
      inline: true,
    });
  }

  embed.addFields(
    {
      name: '🌍 Total Net Worth',
      value: formatSol(totalNetWorth),
      inline: true,
    },
    {
      name: '\u200b', // Empty field to balance the layout
      value: '\u200b',
      inline: true,
    }
  );

  // Footer with last updated info
  if (lastUpdated) {
    const lastUpdateDate = new Date(lastUpdated).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    embed.setFooter({
      text: `Last updated: ${lastUpdateDate}`,
    });
  }

  embed.setTimestamp();

  return embed;
}

export function generateParticipantsDetailsEmbed(participants: ParticipantDisplayInfo[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('👥 Investment Details');

  if (participants.length === 0) {
    embed.setDescription('No participants found.');
    return embed;
  }

  for (let i = 0; i < participants.length; i += 4) {
    const rowParticipants = participants.slice(i, i + 4);

    rowParticipants.forEach(participant => {
      const solscanUrl = `https://solscan.io/account/${config.solana.phase.wallet}?exclude_amount_zero=true&remove_spam=true&from_address=${participant.walletAddress}`;

      let field = `${participant.statusIcon} <@${participant.discordUserId}>
[${participant.shortWallet}](${solscanUrl})
💰 ${participant.investedAmount.toFixed(4)} SOL
📊 Share: ${formatPercent(participant.sharePercentage)}`;

      // Add P&L information if available
      if (participant.pnlAmount !== undefined && participant.pnlPercentage !== undefined) {
        const pnlEmoji = participant.pnlAmount >= 0 ? '📈' : '📉';
        const sign = participant.pnlAmount >= 0 ? '+' : '';
        field += `\n${pnlEmoji} P&L: ${sign}${participant.pnlAmount.toFixed(4)} SOL`;
      } else {
        field += '\n📊 P&L: —';
      }

      embed.addFields({
        name: '\u200b',
        value: field,
        inline: true,
      });
    });
  }

  embed.setFooter({
    text: `Total: ${participants.length} participants displayed`,
  });

  return embed;
}

export function convertParticipantsToDisplayInfo(
  participants: ParticipantEntity[],
  totalInvested: number,
  totalNetWorth?: number
): ParticipantDisplayInfo[] {
  const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);

  return participants.map(participant => {
    let statusIcon: string;
    if (participant.investedAmount === 0) {
      statusIcon = '❌';
    } else if (participant.investedAmount >= minSolAmount) {
      statusIcon = '✅';
    } else {
      statusIcon = '⚠️';
    }

    // Calculate share percentage
    const sharePercentage = totalInvested > 0
      ? (participant.investedAmount / totalInvested) * 100
      : 0;

    // Calculate current value and P&L if total net worth is available
    let currentValue: number | undefined;
    let pnlAmount: number | undefined;
    let pnlPercentage: number | undefined;

    if (totalNetWorth !== undefined && participant.investedAmount > 0) {
      currentValue = (sharePercentage / 100) * totalNetWorth;
      pnlAmount = currentValue - participant.investedAmount;
      pnlPercentage = (pnlAmount / participant.investedAmount) * 100;
    }

    return {
      discordUserId: participant.userId,
      walletAddress: participant.walletAddress,
      shortWallet: participant.getShortWalletAddress(),
      investedAmount: participant.investedAmount,
      statusIcon,
      sharePercentage,
      currentValue,
      pnlAmount,
      pnlPercentage,
    };
  });
}
