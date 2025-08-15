import { EmbedBuilder } from 'discord.js';
import type { ParticipantEntity } from '@domain/entities/participant.entity';
import { config } from '@infrastructure/config/env';

export interface ParticipantsOverviewData {
  totalParticipants: number;
  activeParticipants: number;
  totalInvested: number;
}

export interface ParticipantDisplayInfo {
  discordUserId: string;
  walletAddress: string;
  shortWallet: string;
  investedAmount: number;
  statusIcon: string; // ✅, ❌, or ⚠️
}

export function generateParticipantsOverviewEmbed(data: ParticipantsOverviewData): EmbedBuilder {
  const { totalParticipants, activeParticipants, totalInvested } = data;

  const activePercentage = totalParticipants > 0
    ? ((activeParticipants / totalParticipants) * 100).toFixed(1)
    : '0.0';

  const embed = new EmbedBuilder()
    .setColor(0x9945ff)
    .setTitle('💎 Investment Participant Dashboard')
    .addFields(
      {
        name: '📈 Participants Overview',
        value: `${activeParticipants}/${totalParticipants} participants with investments\n(${activePercentage}%)`,
        inline: true,
      },
      {
        name: '💰 Total Invested',
        value: `${totalInvested.toFixed(4)} SOL`,
        inline: true,
      },
    );

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
      const field = `${participant.statusIcon} <@${participant.discordUserId}>
[${participant.shortWallet}](${solscanUrl})
💰 ${participant.investedAmount.toFixed(4)} SOL`;

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

export function convertParticipantsToDisplayInfo(participants: ParticipantEntity[]): ParticipantDisplayInfo[] {
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

    return {
      discordUserId: participant.userId,
      walletAddress: participant.walletAddress,
      shortWallet: participant.getShortWalletAddress(),
      investedAmount: participant.investedAmount,
      statusIcon,
    };
  });
}
