import type { ButtonInteraction } from 'discord.js';
import type { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import type { InitGuildSettingsUseCase } from '@application/use-cases/init-guild-settings.use-case';
import type { UpdateGuildSettingsUseCase } from '@application/use-cases/update-guild-settings.use-case';
import { buildStep5Embed, buildStep5Components } from '@presentation/ui/embeds/setup-flow.embed';
import { sendSimpleInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

/**
 * Handles Step 4: Final Confirmation and Guild Settings Creation
 * - Validates session is complete with all required data
 * - Creates guild settings in database
 * - Shows completion message
 * - Cleans up session
 */
export class SetupStep4Handler {
  constructor(
    private readonly sessionService: SetupSessionService,
    private readonly initGuildUC: InitGuildSettingsUseCase,
    private readonly updateGuildUC: UpdateGuildSettingsUseCase,
  ) {}

  async handle(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    logger.debug('Processing step 4 - final confirmation', {
      guildId: session.guildId,
      userId: session.userId,
    });
    const isValid = await this.validateSessionCompleteness(interaction, session);
    if (!isValid) return;

    await this.createGuildSettings(interaction, session);
    await this.showCompletionAndCleanup(interaction, session);
  }

  private async validateSessionCompleteness(
    interaction: ButtonInteraction,
    session: SetupSessionData,
  ): Promise<boolean> {
    if (!this.sessionService.isSessionComplete(session)) {
      await sendSimpleInteractionError(interaction, '❌ Setup is incomplete. Please fill all required fields.', {
        guildId: session.guildId,
        userId: session.userId,
        sessionData: session.data,
        step: 4,
        operation: 'session_completeness_validation',
      });
      return false;
    }

    // Validate required fields
    if (!session.data.globalChannelId) {
      await sendSimpleInteractionError(
        interaction,
        '❌ Global channel is required. Please go back and select a channel.',
        {
          guildId: session.guildId,
          userId: session.userId,
          step: 4,
          operation: 'required_field_validation',
        },
      );
      return false;
    }

    if (!session.data.timezone) {
      await sendSimpleInteractionError(interaction, '❌ Timezone is required. Please go back and select a timezone.', {
        guildId: session.guildId,
        userId: session.userId,
        step: 4,
        operation: 'required_field_validation',
      });
      return false;
    }

    logger.debug('Session completeness validation successful', {
      guildId: session.guildId,
      userId: session.userId,
      hasWallet: !!session.data.walletAddress,
    });

    return true;
  }

  private async createGuildSettings(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    // Create guild settings with default values first
    await this.initGuildUC.execute(session.guildId);

    // Update with session data
    const updates: any = {
      globalChannelId: session.data.globalChannelId,
      timezone: session.data.timezone,
    };

    // Add position size defaults if wallet data is present
    if (session.data.walletAddress || session.data.stopLossPercent) {
      updates.positionSizeDefaults = {
        walletAddress: session.data.walletAddress || null,
        stopLossPercent: session.data.stopLossPercent || null,
      };
    }

    await this.updateGuildUC.execute(session.guildId, updates);

    logger.info('Guild settings created and updated successfully', {
      guildId: session.guildId,
      userId: session.userId,
      globalChannelId: session.data.globalChannelId,
      timezone: session.data.timezone,
      hasWallet: !!session.data.walletAddress,
      hasStopLoss: !!session.data.stopLossPercent,
    });
  }

  private async showCompletionAndCleanup(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    // Build completion interface
    const embed = buildStep5Embed();
    const components = buildStep5Components();

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    // Clean up session
    this.sessionService.deleteSession(session.guildId, session.userId);

    logger.info('Setup completed successfully', {
      guildId: session.guildId,
      userId: session.userId,
      globalChannelId: session.data.globalChannelId,
      timezone: session.data.timezone,
      hasWallet: !!session.data.walletAddress,
      hasStopLoss: !!session.data.stopLossPercent,
    });
  }
}
