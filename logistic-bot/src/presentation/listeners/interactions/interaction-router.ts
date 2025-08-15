import type { Interaction } from 'discord.js';
import { logger } from '@helpers/logger';

export class InteractionRouter {
  private static instance: InteractionRouter;

  private constructor() {}

  static getInstance(): InteractionRouter {
    if (!InteractionRouter.instance) {
      InteractionRouter.instance = new InteractionRouter();
    }
    return InteractionRouter.instance;
  }

  async routeInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isButton() &&
        !interaction.isStringSelectMenu() &&
        !interaction.isChannelSelectMenu() &&
        !interaction.isModalSubmit() &&
        !interaction.isUserSelectMenu() &&
        !interaction.isRoleSelectMenu()) {
      return;
    }

    const customId = interaction.customId;
    logger.debug(`Routing interaction: ${customId}`);

    try {
      // Router vers le handler approprié basé sur le customId
      // if (customId.startsWith('channels:')) {

      // } else {
      //   logger.warn(`No handler found for interaction: ${customId}`);
      // }
    } catch (error) {
      logger.error(`Error routing interaction: ${customId}`, error as Error);

      const content = '❌ An error occurred while processing your request.';
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Failed to send error response', replyError as Error);
      }
    }
  }
}