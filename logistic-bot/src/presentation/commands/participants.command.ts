import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { isUserAdmin, replyAdminOnly } from '@helpers/permissions';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import { WalletInfoService } from '@infrastructure/services/wallet-info.service';
import { WalletSchedulerService } from '@infrastructure/services/wallet-scheduler.service';
import {
  generateParticipantsOverviewEmbed,
  generateParticipantsDetailsEmbed,
  convertParticipantsToDisplayInfo,
  calculateDailyRoi,
  type ParticipantsOverviewData
} from '@presentation/ui/embeds/participants.embed';

export const participantsCommand = {
  data: new SlashCommandBuilder()
    .setName('participants')
    .setDescription('[ADMIN] View all participants and their investment details.'),

  async execute(interaction: CommandInteraction) {
    try {
      if (!isUserAdmin(interaction)) {
        await replyAdminOnly(interaction);
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const participantRepo = new DynamoParticipantRepository();

      const allParticipants = await participantRepo.getAll();

      const globalStats = await participantRepo.getGlobalStats();

      // Fetch wallet performance data
      let totalNetWorth: number | undefined;
      let dailyRoi: number | undefined;
      let lastUpdated: number | undefined;

      try {
        const walletInfoService = WalletInfoService.getInstance();
        const walletInfo = await walletInfoService.getWalletInfo();

        totalNetWorth = walletInfo.totalNetWorth;
        lastUpdated = walletInfo.lastUpdated;

        // Calculate daily ROI
        dailyRoi = calculateDailyRoi(globalStats.totalInvested, totalNetWorth);

        // Get last sync time from scheduler
        const walletScheduler = WalletSchedulerService.getInstance();
        const lastSyncTime = walletScheduler.getLastSyncTime();
        if (lastSyncTime) {
          lastUpdated = lastSyncTime;
        }
      } catch (error) {
        logger.warn('Failed to fetch wallet performance data for participants overview', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const overviewData: ParticipantsOverviewData = {
        totalParticipants: globalStats.participantCount,
        activeParticipants: globalStats.activeParticipants,
        totalInvested: globalStats.totalInvested,
        totalNetWorth,
        dailyRoi,
        lastUpdated,
      };

      const overviewEmbed = generateParticipantsOverviewEmbed(overviewData);

      const participantDisplayInfo = convertParticipantsToDisplayInfo(
        allParticipants,
        globalStats.totalInvested,
        totalNetWorth
      );

      const detailsEmbed = generateParticipantsDetailsEmbed(participantDisplayInfo);

      await interaction.editReply({
        embeds: [overviewEmbed, detailsEmbed]
      });

      logger.info(`Admin ${interaction.user.id} executed participants command`, {
        totalParticipants: globalStats.participantCount,
        activeParticipants: globalStats.activeParticipants,
      });

    } catch (error) {
      logger.error('Error executing participants command', error as Error);

      const errorMessage = '❌ An error occurred while processing the participants command. Please try again later.';

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        });
      }
    }
  },
};