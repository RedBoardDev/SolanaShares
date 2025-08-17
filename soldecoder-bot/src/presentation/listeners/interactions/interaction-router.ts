import type { Interaction } from 'discord.js';
import { ChannelInteractionHandler } from './channel-interaction.handler';
import { ServerInteractionHandler } from './server-interaction.handler';
import { SetupInteractionHandler } from './setup-account';
import { GuideInteractionHandler } from './guide-interaction.handler';
import { DonateInteractionHandler } from './donate-interaction.handler';
import { logger } from '@helpers/logger';

export class InteractionRouter {
  private static instance: InteractionRouter;
  private channelHandler: ChannelInteractionHandler;
  private serverHandler: ServerInteractionHandler;
  private setupHandler: SetupInteractionHandler;
  private guideHandler: GuideInteractionHandler;
  private donateHandler: DonateInteractionHandler;

  private constructor() {
    this.channelHandler = new ChannelInteractionHandler();
    this.serverHandler = new ServerInteractionHandler();
    this.setupHandler = new SetupInteractionHandler();
    this.guideHandler = new GuideInteractionHandler();
    this.donateHandler = new DonateInteractionHandler();
  }

  static getInstance(): InteractionRouter {
    if (!InteractionRouter.instance) {
      InteractionRouter.instance = new InteractionRouter();
    }
    return InteractionRouter.instance;
  }

  async routeInteraction(interaction: Interaction): Promise<void> {
    if (
      !interaction.isButton() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isChannelSelectMenu() &&
      !interaction.isModalSubmit() &&
      !interaction.isUserSelectMenu() &&
      !interaction.isRoleSelectMenu()
    ) {
      return;
    }

    const customId = interaction.customId;
    logger.debug(`Routing interaction: ${customId}`);

    try {
      if (
        customId.startsWith('channels:') ||
        customId.startsWith('channel:') ||
        customId.startsWith('threshold:') ||
        customId.startsWith('tag:')
      ) {
        await this.channelHandler.handleInteraction(interaction);
      } else if (customId.startsWith('server:')) {
        await this.serverHandler.handleInteraction(interaction);
      } else if (customId.startsWith('setup:')) {
        await this.setupHandler.handleInteraction(interaction);
      } else if (customId.startsWith('guide:')) {
        await this.guideHandler.handleInteraction(interaction);
      } else if (customId.startsWith('donate:')) {
        if (interaction.isButton()) {
          await this.donateHandler.handleInteraction(interaction);
        }
      } else {
        logger.warn(`No handler found for interaction: ${customId}`);
      }
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
