import type { ButtonInteraction } from 'discord.js';
import type { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import {
  buildStep1Embed,
  buildStep1Components,
  buildStep2Embed,
  buildStep2Components,
  buildStep3Embed,
  buildStep3Components,
  buildStep4Embed,
  buildStep4Components,
} from '@presentation/ui/embeds/setup-flow.embed';
import { sendSimpleInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

/**
 * Manages setup session lifecycle and navigation
 * - Handles session cancellation, resume, restart
 * - Manages navigation (back buttons)
 * - Provides session state management
 */
export class SetupSessionManager {
  constructor(private readonly sessionService: SetupSessionService) {}

  async handleCancel(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    this.sessionService.deleteSession(guildId, userId);

    await interaction.editReply({
      content: '❌ Setup cancelled. You can restart anytime with `/start`.',
      embeds: [],
      components: [],
    });

    logger.info('Setup session cancelled', { guildId, userId });
  }

  async handleRestart(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    // Delete existing session and start fresh
    this.sessionService.deleteSession(guildId, userId);

    // Create new session
    const newSession = this.sessionService.createSession(guildId, userId);
    if (!newSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to create setup session. Please try again.', {
        guildId,
        userId,
        operation: 'session_creation',
      });
      return;
    }

    // Show step 1
    const embed = buildStep1Embed();
    const components = buildStep1Components();

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    logger.info('Setup session restarted', { guildId, userId });
  }

  async handleResume(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    const session = this.sessionService.getSession(guildId, userId);

    if (!session) {
      await sendSimpleInteractionError(interaction, '❌ No active session found. Please run `/start` to begin setup.', {
        guildId,
        userId,
        operation: 'session_resume',
      });
      return;
    }

    try {
      await this.displayCurrentStep(interaction, session);
      logger.info('Setup session resumed', {
        guildId,
        userId,
        currentStep: session.currentStep,
      });
    } catch (error) {
      await sendSimpleInteractionError(interaction, '❌ Invalid session state. Please restart with `/start`.', {
        guildId,
        userId,
        currentStep: session.currentStep,
        operation: 'session_state_validation',
      });

      // Clean up invalid session
      this.sessionService.deleteSession(session.guildId, session.userId);
    }
  }

  async handleBack(interaction: ButtonInteraction, session: SetupSessionData, targetStep: number): Promise<void> {
    if (targetStep < 1 || targetStep > 4) {
      await sendSimpleInteractionError(interaction, '❌ Invalid step number.', {
        guildId: session.guildId,
        userId: session.userId,
        targetStep,
        currentStep: session.currentStep,
        operation: 'navigation_validation',
      });
      return;
    }

    // Update session to target step
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: targetStep,
    });

    if (!updatedSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to navigate back. Please try again.', {
        guildId: session.guildId,
        userId: session.userId,
        targetStep,
        operation: 'navigation_update',
      });
      return;
    }

    await this.displayCurrentStep(interaction, updatedSession);

    logger.debug('Setup navigation completed', {
      guildId: session.guildId,
      userId: session.userId,
      fromStep: session.currentStep,
      toStep: targetStep,
    });
  }

  private async displayCurrentStep(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    let embed;
    let components;

    switch (session.currentStep) {
      case 1:
        embed = buildStep1Embed();
        components = buildStep1Components();
        break;

      case 2:
        embed = buildStep2Embed(session);
        components = buildStep2Components();
        break;

      case 3:
        embed = buildStep3Embed(session);
        components = buildStep3Components();
        break;

      case 4:
        embed = buildStep4Embed(session);
        components = buildStep4Components();
        break;

      default:
        throw new Error(`Invalid step: ${session.currentStep}`);
    }

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });
  }
}
