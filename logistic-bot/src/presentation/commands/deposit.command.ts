import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { calculatePhaseStatus } from '@infrastructure/services/phase-status.service';
import { generateActiveDepositEmbed, generateClosedDepositEmbed } from '@presentation/ui/embeds/deposit.embed';

export const depositCommand = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Displays the current SOL deposit address, deadline, and phase status for deposits.'),

  async execute(interaction: CommandInteraction) {
    try {
      const phaseStatus = calculatePhaseStatus();

      const embed = phaseStatus.isRegistrationActive
        ? generateActiveDepositEmbed(phaseStatus)
        : generateClosedDepositEmbed(phaseStatus);

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      logger.error('Error executing deposit command', error as Error);
      await interaction.reply({
        content: '❌ An error occurred while processing the deposit command. Please try again later.',
        ephemeral: true
      });
    }
  },
};
