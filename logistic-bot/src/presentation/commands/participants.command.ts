import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { isUserAdmin, replyAdminOnly } from '@helpers/permissions';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import {
  generateParticipantsOverviewEmbed,
  generateParticipantsDetailsEmbed,
  convertParticipantsToDisplayInfo,
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

      const overviewData: ParticipantsOverviewData = {
        totalParticipants: globalStats.participantCount,
        activeParticipants: globalStats.activeParticipants,
        totalInvested: globalStats.totalInvested,
      };

      const overviewEmbed = generateParticipantsOverviewEmbed(overviewData);

      const participantDisplayInfo = convertParticipantsToDisplayInfo(allParticipants);

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