import type { StringSelectMenuInteraction } from 'discord.js';
import type { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import { TimezoneHelper, type Timezone } from '@domain/value-objects/timezone';
import { buildStep4Embed, buildStep4Components } from '@presentation/ui/embeds/setup-flow.embed';
import { sendSimpleInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

/**
 * Handles Step 3: Timezone Selection
 * - Validates selected timezone is valid
 * - Updates session with timezone
 * - Moves to step 4 (final confirmation)
 */
export class SetupStep3Handler {
  constructor(private readonly sessionService: SetupSessionService) {}

  async handle(interaction: StringSelectMenuInteraction, session: SetupSessionData): Promise<void> {
    const selectedTimezone = interaction.values[0] as Timezone;

    logger.debug('Processing step 3 - timezone selection', {
      guildId: session.guildId,
      userId: session.userId,
      selectedTimezone,
    });
    const isValid = await this.validateTimezone(interaction, selectedTimezone);
    if (!isValid) return;

    await this.updateSessionAndProceed(interaction, session, selectedTimezone);
  }

  private async validateTimezone(interaction: StringSelectMenuInteraction, selectedTimezone: string): Promise<boolean> {
    if (!TimezoneHelper.isValid(selectedTimezone)) {
      await sendSimpleInteractionError(interaction, '❌ Invalid timezone selected.', {
        selectedTimezone,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        step: 3,
        operation: 'timezone_validation',
      });
      return false;
    }

    logger.debug('Timezone validation successful', {
      selectedTimezone,
      guildId: interaction.guildId,
    });

    return true;
  }

  private async updateSessionAndProceed(
    interaction: StringSelectMenuInteraction,
    session: SetupSessionData,
    selectedTimezone: Timezone,
  ): Promise<void> {
    // Update session with timezone and move to step 4
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 4,
      data: { timezone: selectedTimezone },
    });

    if (!updatedSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to update setup session. Please try again.', {
        guildId: session.guildId,
        userId: session.userId,
        step: 3,
        operation: 'session_update',
      });
      return;
    }

    // Build step 4 interface (final confirmation)
    const embed = buildStep4Embed(updatedSession);
    const components = buildStep4Components();

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    logger.info('Step 3 completed successfully', {
      guildId: session.guildId,
      userId: session.userId,
      selectedTimezone,
    });
  }
}
