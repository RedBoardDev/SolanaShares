import type { ButtonInteraction } from 'discord.js';
import { sendInteractionError } from '@presentation/helpers/interaction-error.helper';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

export class DonateInteractionHandler {
  async handleInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      const [action] = interaction.customId.split(':');

      switch (action) {
        case 'donate':
          await this.handleDonateAction(interaction);
          break;
        default:
          logger.warn('Unknown donate action', { customId: interaction.customId });
          break;
      }
    } catch (error) {
      await sendInteractionError(interaction, error, {
        operation: 'donate_interaction',
        customId: interaction.customId,
      });
    }
  }

  private async handleDonateAction(interaction: ButtonInteraction): Promise<void> {
    const [, action] = interaction.customId.split(':');

    switch (action) {
      case 'show_embed':
        await this.handleShowEmbed(interaction);
        break;
      case 'copy_address':
        await this.handleCopyAddress(interaction);
        break;
      default:
        logger.warn('Unknown donate action', { action, customId: interaction.customId });
        break;
    }
  }

  private async handleShowEmbed(interaction: ButtonInteraction): Promise<void> {
    const { buildDonateEmbed } = await import('@presentation/ui/embeds/donate.embed');

    const embed = buildDonateEmbed();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  private async handleCopyAddress(interaction: ButtonInteraction): Promise<void> {
    await interaction.reply({
      content: `📋 **Solana Address copied!**\n\`${config.donate.solanaAddress}\`\n\nYou can now paste this address in your Solana wallet to send a donation. Thank you for your support! 💙`,
      ephemeral: true,
    });
  }
}
