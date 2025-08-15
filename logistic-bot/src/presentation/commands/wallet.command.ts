import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import { generateWalletEmbed, generateNoWalletEmbed, generateInsufficientInvestmentEmbed, type WalletDisplayData } from '@presentation/ui/embeds/wallet.embed';
import { WalletInfoService } from '@infrastructure/services/wallet-info.service';
import { config } from '@infrastructure/config/env';

export const walletCommand = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('View your current investment details and wallet information.'),

  async execute(interaction: CommandInteraction) {
    try {
      const discordUserId = interaction.user.id;
      const participantRepo = new DynamoParticipantRepository();

      const participant = await participantRepo.findByDiscordUser(discordUserId);

      if (!participant) {
        const embed = generateNoWalletEmbed();
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        return;
      }

      const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
      const isActiveInvestor = participant.investedAmount >= minSolAmount;

      if (!isActiveInvestor) {
        const embed = generateInsufficientInvestmentEmbed(participant.investedAmount, minSolAmount);
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        return;
      }

      const globalStats = await participantRepo.getGlobalStats();

      const userSharePercentage = globalStats.totalInvested > 0
        ? (participant.investedAmount / globalStats.totalInvested) * 100
        : 0;

      let totalNetWorth: number | undefined;
      let userCurrentValue: number | undefined;
      let userPnlAmount: number | undefined;
      let userPnlPercentage: number | undefined;

      try {
        const walletInfoService = WalletInfoService.getInstance();
        const walletInfo = await walletInfoService.getWalletInfo();

        totalNetWorth = walletInfo.totalNetWorth;

        userCurrentValue = (userSharePercentage / 100) * totalNetWorth;

        userPnlAmount = userCurrentValue - participant.investedAmount;
        userPnlPercentage = participant.investedAmount > 0
          ? (userPnlAmount / participant.investedAmount) * 100
          : 0;
      } catch (error) {
        logger.warn('Failed to fetch wallet performance data', { error: error instanceof Error ? error.message : String(error) });
      }

      const walletData: WalletDisplayData = {
        participant,
        globalStats: {
          totalInvested: globalStats.totalInvested,
          activeParticipants: globalStats.activeParticipants,
        },
        userSharePercentage,
        botWalletAddress: config.solana.phase.wallet,
        totalNetWorth,
        userCurrentValue,
        userPnlAmount,
        userPnlPercentage,
      };

      const embed = generateWalletEmbed(walletData);
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error executing wallet command', error as Error);
      await interaction.reply({
        content: '❌ An error occurred while processing the wallet command. Please try again later.',
        ephemeral: true
      });
    }
  },
};
