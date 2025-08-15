import { EmbedBuilder } from 'discord.js';
import type { ParticipantEntity } from '@domain/entities/participant.entity';
import { SyncStatusEmbed } from './sync-status.embed';
import { config } from '@infrastructure/config/env';
import { WalletSchedulerService } from '@infrastructure/services/wallet-scheduler.service';

export interface WalletDisplayData {
  participant: ParticipantEntity;
  globalStats: {
    totalInvested: number;
    activeParticipants: number;
  };
  userSharePercentage: number;
  botWalletAddress: string;
  totalNetWorth?: number;
  userCurrentValue?: number;
  userPnlAmount?: number;
  userPnlPercentage?: number;
}

function formatSol(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value.toFixed(4)} SOL`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}

function buildAccountSection(participant: ParticipantEntity): { name: string; value: string; inline?: boolean } {
  const shortWallet = participant.getShortWalletAddress();
  const solscanUrl = `https://solscan.io/account/${participant.walletAddress}`;

  const joinedDate = new Date(participant.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  const lastUpdate = new Date(participant.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  return {
    name: '👤 Account',
    value: `Wallet: \`${shortWallet}\`\nJoined: ${joinedDate}\nLast Update: ${lastUpdate}\n[View on Solscan](${solscanUrl})`,
    inline: false,
  };
}

function buildInvestmentSection(
  participant: ParticipantEntity,
  userSharePercentage: number,
  userCurrentValue?: number,
  userPnlAmount?: number,
  userPnlPercentage?: number,
): { name: string; value: string; inline?: boolean } {
  const invested = formatSol(participant.investedAmount);
  const share = formatPercent(userSharePercentage);

  let value = `Invested: **${invested}**\nShare: **${share}**`;

  if (
    userCurrentValue !== undefined &&
    userPnlAmount !== undefined &&
    userPnlPercentage !== undefined
  ) {
    const pnlEmoji = userPnlAmount >= 0 ? '📈' : '📉';
    const sign = userPnlAmount >= 0 ? '+' : '';
    value += `\nCurrent Value: **${formatSol(userCurrentValue)}**`;
    value += `\nP&L: ${pnlEmoji} **${sign}${userPnlAmount.toFixed(4)} SOL (${sign}${userPnlPercentage.toFixed(2)}%)**`;
    const walletScheduler = WalletSchedulerService.getInstance();
    const lastSyncTime = walletScheduler.getLastSyncTime();
    if (lastSyncTime) {
      const lastSyncSeconds = Math.floor(lastSyncTime / 1000);
      value += `\n*Last update: <t:${lastSyncSeconds}:R>*`;
    }
  }

  return { name: '💼 Your Investment', value, inline: false };
}

function buildPoolSection(
  totalInvested: number,
  activeParticipants: number,
  totalNetWorth?: number
): { name: string; value: string; inline?: boolean } {
  let value = `Total Pool: **${totalInvested.toFixed(4)} SOL**\nActive Investors: **${activeParticipants}**`;

  if (totalNetWorth !== undefined) {
    value += `\nTotal Net Worth: **${totalNetWorth.toFixed(4)} SOL**`;

    // Calculate daily average gain percentage
    try {
      const startDate = new Date(config.solana.phase.startDate);
      const now = new Date();
      const daysSinceStart = Math.max(1, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (totalInvested > 0) {
        const totalGain = totalNetWorth - totalInvested;
        const dailyGainPercentage = (totalGain / totalInvested / daysSinceStart) * 100;

        if (dailyGainPercentage > 0) {
          value += `\nDaily ROI: **+${dailyGainPercentage.toFixed(2)}%**`;
        } else if (dailyGainPercentage < 0) {
          value += `\nDaily ROI: **-${Math.abs(dailyGainPercentage).toFixed(2)}%**`;
        } else {
          value += `\nDaily ROI: **0.00%**`;
        }
      }
    } catch (error) {
      // Silently ignore if date calculation fails
    }
  }

  return { name: '🌐 Pool', value, inline: false };
}

function buildLinksSection(botWalletAddress: string): { name: string; value: string; inline?: boolean } {
  return {
    name: '🔗 Links',
    value: `[📈 Portfolio Analytics](https://app.lpagent.io/portfolio?address=${botWalletAddress})`,
    inline: false,
  };
}

export function generateWalletEmbed(data: WalletDisplayData): EmbedBuilder {
  const { participant, globalStats, userSharePercentage, botWalletAddress } = data;

  const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
  const isActive = participant.investedAmount >= minSolAmount;
  const statusEmoji = isActive ? '🟢' : '🔴';
  const statusText = isActive ? 'Active investor' : `Registered (below minimum of ${minSolAmount.toFixed(4)} SOL)`;

  const embed = new EmbedBuilder()
    .setColor(isActive ? 0x00ff00 : 0x9945ff)
    .setTitle('💼 Wallet Overview')
    .setDescription(`${statusEmoji} **${statusText}**`);

  embed.addFields(buildAccountSection(participant));

  embed.addFields(
    buildInvestmentSection(
      participant,
      userSharePercentage,
      data.userCurrentValue,
      data.userPnlAmount,
      data.userPnlPercentage,
    )
  );

  embed.addFields(buildPoolSection(globalStats.totalInvested, globalStats.activeParticipants, data.totalNetWorth));

  embed.addFields(buildLinksSection(botWalletAddress));

  embed
    .setFooter({
      text: SyncStatusEmbed.getNextSyncInfo(),
    })
    .setTimestamp();

  return embed;
}

export function generateNoWalletEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle('❌ No Wallet Linked')
    .setDescription('You haven\'t linked a wallet to your Discord account yet.')
    .addFields(
      {
        name: '🔧 How to get started',
        value:
          '1. Use `/link-wallet` command\n' +
          '2. Provide your Solana wallet address\n' +
          '3. Send SOL to the deposit address\n' +
          '4. Use `/wallet` to check your status',
        inline: false,
      },
      {
        name: '💡 Need help?',
        value: 'Make sure you have a valid Solana wallet address before linking.',
        inline: false,
      }
    )
    .setFooter({
      text: '💼 Get started by linking your wallet first!',
    })
    .setTimestamp();
}

export function generateInsufficientInvestmentEmbed(currentAmount: number, minRequired: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle('⚠️ Insufficient Investment')
    .setDescription('You have linked your wallet but haven\'t reached the minimum investment threshold yet.')
    .addFields(
      { name: '💰 Current Investment', value: `**${currentAmount.toFixed(4)} SOL**`, inline: true },
      { name: '🎯 Required Minimum', value: `**${minRequired} SOL**`, inline: true },
      { name: '📊 Remaining', value: `**${Math.max(0, minRequired - currentAmount).toFixed(4)} SOL**`, inline: true },
    )
    .setFooter({
      text: `Send more SOL to become an active investor • ${SyncStatusEmbed.getNextSyncInfo()}`
    })
    .setTimestamp();
}
