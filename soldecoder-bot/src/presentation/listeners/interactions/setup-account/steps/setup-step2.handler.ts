import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import type { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import {
  buildWalletStopLossModal,
  buildStep3Embed,
  buildStep3Components,
} from '@presentation/ui/embeds/setup-flow.embed';
import { sendSimpleInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

/**
 * Handles Step 2: Wallet and Stop Loss Configuration
 * - Shows wallet modal for configuration
 * - Validates wallet address format
 * - Validates stop loss percentage (0-100)
 * - Updates session and moves to step 3
 */
export class SetupStep2Handler {
  constructor(private readonly sessionService: SetupSessionService) {}

  async handle(interaction: ButtonInteraction | ModalSubmitInteraction, session: SetupSessionData): Promise<void> {
    if (interaction.isButton() && interaction.customId === 'setup:step2:wallet_modal') {
      await this.showWalletModal(interaction);
    } else if (interaction.isButton() && interaction.customId === 'setup:step2:continue') {
      await this.continueWithoutWallet(interaction, session);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith('setup:step2:wallet_submit')) {
      await this.processWalletSubmission(interaction, session);
    }
  }

  private async showWalletModal(interaction: ButtonInteraction): Promise<void> {
    const modal = buildWalletStopLossModal();
    await interaction.showModal(modal);

    logger.debug('Wallet modal displayed', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });
  }

  private async continueWithoutWallet(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    // Update session to step 3 without wallet data
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 3,
    });

    if (!updatedSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to update setup session. Please try again.', {
        guildId: session.guildId,
        userId: session.userId,
        step: 2,
        operation: 'session_update',
      });
      return;
    }

    await this.proceedToStep3(interaction, updatedSession);
  }

  private async processWalletSubmission(interaction: ModalSubmitInteraction, session: SetupSessionData): Promise<void> {
    const walletAddress = interaction.fields.getTextInputValue('wallet_address');
    const stopLossInput = interaction.fields.getTextInputValue('stop_loss_percent');
    const validatedData = await this.validateWalletData(interaction, walletAddress, stopLossInput);
    if (!validatedData) return; // Validation failed, error already sent

    await this.updateSessionWithWalletData(interaction, session, validatedData);
  }

  private async validateWalletData(
    interaction: ModalSubmitInteraction,
    walletAddress: string,
    stopLossInput: string,
  ): Promise<{ walletAddress: string; stopLossPercent: number } | null> {
    // Validate wallet address
    if (!WalletAddress.isValid(walletAddress)) {
      await sendSimpleInteractionError(
        interaction,
        '❌ Invalid wallet address. Please provide a valid Solana address.',
        {
          walletAddress,
          guildId: interaction.guildId,
          userId: interaction.user.id,
          step: 2,
          operation: 'wallet_validation',
        },
      );
      return null;
    }

    // Validate stop loss percentage
    let stopLossPercent: number;
    try {
      const parsed = Number.parseFloat(stopLossInput);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
        await sendSimpleInteractionError(interaction, '❌ Stop loss must be a number between 0 and 100.', {
          stopLossInput,
          guildId: interaction.guildId,
          userId: interaction.user.id,
          step: 2,
          operation: 'stop_loss_validation',
        });
        return null;
      }
      stopLossPercent = parsed;
    } catch (error) {
      await sendSimpleInteractionError(
        interaction,
        '❌ Invalid stop loss format. Please enter a number between 0 and 100.',
        {
          stopLossInput,
          guildId: interaction.guildId,
          userId: interaction.user.id,
          step: 2,
          operation: 'stop_loss_format_validation',
        },
      );
      return null;
    }

    return { walletAddress, stopLossPercent };
  }

  private async updateSessionWithWalletData(
    interaction: ModalSubmitInteraction,
    session: SetupSessionData,
    validatedData: { walletAddress: string; stopLossPercent: number },
  ): Promise<void> {
    // Update session with wallet data and move to step 3
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 3,
      data: {
        walletAddress: validatedData.walletAddress,
        stopLossPercent: validatedData.stopLossPercent,
      },
    });

    if (!updatedSession) {
      await sendSimpleInteractionError(interaction, '❌ Failed to update setup session. Please try again.', {
        guildId: session.guildId,
        userId: session.userId,
        step: 2,
        operation: 'session_update',
      });
      return;
    }

    await interaction.editReply({
      content: '✅ Wallet configured successfully! Moving to timezone selection...',
    });

    // Proceed to step 3 after a brief moment
    await this.proceedToStep3AfterDelay(interaction, updatedSession);
  }

  private async proceedToStep3(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    session: SetupSessionData,
  ): Promise<void> {
    const embed = buildStep3Embed(session);
    const components = buildStep3Components();

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    logger.info('Step 2 completed successfully', {
      guildId: session.guildId,
      userId: session.userId,
      hasWallet: !!session.data.walletAddress,
    });
  }

  private async proceedToStep3AfterDelay(
    interaction: ModalSubmitInteraction,
    session: SetupSessionData,
  ): Promise<void> {
    try {
      // Wait a moment then proceed to step 3
      setTimeout(async () => {
        try {
          await this.proceedToStep3(interaction, session);
        } catch (error) {
          logger.error('Failed to proceed to step 3 after delay', error as Error, {
            guildId: session.guildId,
            userId: session.userId,
          });
        }
      }, 1500);
    } catch (error) {
      await this.proceedToStep3(interaction, session);
    }
  }
}

