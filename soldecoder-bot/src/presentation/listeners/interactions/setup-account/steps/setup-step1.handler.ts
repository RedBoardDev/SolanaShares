import { type ChannelSelectMenuInteraction, ChannelType } from 'discord.js';
import type { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import type { PermissionValidatorService } from '@infrastructure/services/permission-validator.service';
import { buildStep2Embed, buildStep2Components } from '@presentation/ui/embeds/setup-flow.embed';
import { sendSimpleInteractionError, sendInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

/**
 * Handles Step 1: Global Channel Selection
 * - Validates selected channel is a text channel
 * - Validates bot has proper permissions in the channel
 * - Updates session and moves to step 2
 */
export class SetupStep1Handler {
  constructor(
    private readonly sessionService: SetupSessionService,
    private readonly permissionValidator: PermissionValidatorService,
  ) {}

  async handle(interaction: ChannelSelectMenuInteraction, session: SetupSessionData): Promise<void> {
    const selectedChannelId = interaction.values[0];

    logger.debug('Processing step 1 - channel selection', {
      guildId: session.guildId,
      userId: session.userId,
      selectedChannelId,
    });
    const isValid = await this.validateChannelSelection(interaction, selectedChannelId);
    if (!isValid) return;

    await this.updateSessionAndProceed(interaction, session, selectedChannelId);
  }

  private async validateChannelSelection(
    interaction: ChannelSelectMenuInteraction,
    selectedChannelId: string,
  ): Promise<boolean> {
    const channel = interaction.guild!.channels.cache.get(selectedChannelId);

    // Validate channel exists and is text channel
    if (!channel || channel.type !== ChannelType.GuildText) {
      await sendSimpleInteractionError(interaction, '❌ Please select a valid text channel.', {
        selectedChannelId,
        channelType: channel?.type,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        step: 1,
        operation: 'channel_validation',
      });
      return false;
    }

    // Validate bot permissions in the selected channel
    try {
      await this.permissionValidator.validateChannelAccess(interaction.guild!, selectedChannelId);
    } catch (error) {
      // Send the permission error to the user
      await sendInteractionError(interaction, error, {
        selectedChannelId,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        step: 1,
        operation: 'channel_permission_validation',
      });
      return false;
    }

    logger.debug('Channel validation successful', {
      channelId: selectedChannelId,
      channelName: channel.name,
      guildId: interaction.guildId,
    });

    return true;
  }

  private async updateSessionAndProceed(
    interaction: ChannelSelectMenuInteraction,
    session: SetupSessionData,
    selectedChannelId: string,
  ): Promise<void> {
    // Update session with selected channel and move to step 2
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 2,
      data: { globalChannelId: selectedChannelId },
    });

    if (!updatedSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to update setup session. Please try again.', {
        guildId: session.guildId,
        userId: session.userId,
        step: 1,
        operation: 'session_update',
      });
      return;
    }

    // Build step 2 interface
    const embed = buildStep2Embed(updatedSession);
    const components = buildStep2Components();

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    logger.info('Step 1 completed successfully', {
      guildId: session.guildId,
      userId: session.userId,
      selectedChannelId,
      channelName: interaction.guild!.channels.cache.get(selectedChannelId)?.name,
    });
  }
}
