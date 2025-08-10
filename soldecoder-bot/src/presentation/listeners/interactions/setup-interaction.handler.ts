import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { SetupSessionService, SetupSessionData } from '@infrastructure/services/setup-session.service';
import {
  buildStep1Embed, buildStep1Components,
  buildStep2Embed, buildStep2Components, buildWalletStopLossModal,
  buildStep3Embed, buildStep3Components,
  buildStep4Embed, buildStep4Components,
  buildStep5Embed, buildStep5Components
} from '@presentation/ui/embeds/setup-flow.embed';
import { logger } from '@helpers/logger';
import { TimezoneHelper, Timezone } from '@domain/value-objects/timezone';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import { InitGuildSettingsUseCase } from '@application/use-cases/init-guild-settings.use-case';
import { UpdateGuildSettingsUseCase } from '@application/use-cases/update-guild-settings.use-case';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';

export class SetupInteractionHandler {
  private readonly sessionService: SetupSessionService;
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly initGuildUC: InitGuildSettingsUseCase;
  private readonly updateGuildUC: UpdateGuildSettingsUseCase;
  private readonly getChannelsUC: GetGuildChannelsUseCase;

  constructor() {
    this.sessionService = SetupSessionService.getInstance();
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.initGuildUC = new InitGuildSettingsUseCase(this.guildRepo);
    this.updateGuildUC = new UpdateGuildSettingsUseCase(this.guildRepo);
    this.getChannelsUC = new GetGuildChannelsUseCase(this.channelRepo);
  }

  async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ This can only be used in a server.', flags: 64 });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ You need Administrator permissions to use this.', flags: 64 });
      return;
    }

    const customId = interaction.customId;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (customId === 'setup:step2:wallet_modal') {
    } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
      await interaction.deferUpdate();
    } else if (interaction.isModalSubmit()) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      if (customId === 'setup:cancel') {
        if (interaction.isButton()) {
          await this.handleCancel(interaction, guildId, userId);
        }
        return;
      }

      if (customId === 'setup:resume') {
        if (interaction.isButton()) {
          await this.handleResume(interaction, guildId, userId);
        }
        return;
      }

      if (customId === 'setup:restart') {
        if (interaction.isButton()) {
          await this.handleRestart(interaction, guildId, userId);
        }
        return;
      }



      const session = this.sessionService.getSession(guildId, userId);
      if (!session) {
        await interaction.editReply({
          content: '❌ No active setup session found. Please run `/start` to begin setup.'
        });
        return;
      }

      if (!this.sessionService.validateSessionOwner(guildId, userId, session.userId)) {
        await interaction.editReply({
          content: '❌ You are not authorized to interact with this setup session.'
        });
        return;
      }

      if (customId.startsWith('setup:step1:')) {
        if (interaction.isChannelSelectMenu()) {
          await this.handleStep1(interaction, session);
        }
      } else if (customId.startsWith('setup:step2:')) {
        if (interaction.isButton() || interaction.isModalSubmit()) {
          await this.handleStep2(interaction, session);
        }
      } else if (customId.startsWith('setup:step3:')) {
        if (interaction.isStringSelectMenu()) {
          await this.handleStep3(interaction, session);
        }
      } else if (customId.startsWith('setup:step4:')) {
        if (interaction.isButton()) {
          await this.handleStep4(interaction, session);
        }
      } else if (customId.startsWith('setup:back:')) {
        if (interaction.isButton()) {
          await this.handleBack(interaction, session, parseInt(customId.split(':')[2]));
        }
      } else {
        logger.warn(`Unknown setup interaction: ${customId}`);
      }

        } catch (error) {
      logger.error(`Error handling setup interaction: ${customId}`, error as Error);

      const content = '❌ An error occurred during setup. Please try again or restart with `/start`.';
      try {
        await interaction.editReply({ content });
      } catch (replyError) {
        logger.error('Failed to send error response', replyError as Error);
      }
    }
  }

  private async handleStep1(interaction: ChannelSelectMenuInteraction, session: SetupSessionData): Promise<void> {
    const selectedChannelId = interaction.values[0];
    const channel = interaction.guild!.channels.cache.get(selectedChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: '❌ Please select a valid text channel.' });
      return;
    }

    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 2,
      data: { globalChannelId: selectedChannelId }
    });

    const embed = buildStep2Embed(updatedSession);
    const components = buildStep2Components(false);

    await interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  private async handleStep2(interaction: ButtonInteraction | ModalSubmitInteraction, session: SetupSessionData): Promise<void> {
    if (interaction.isButton() && interaction.customId === 'setup:step2:wallet_modal') {
      const modal = buildWalletStopLossModal();
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'setup:step2:continue') {
      const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
        currentStep: 3
      });

      const embed = buildStep3Embed(updatedSession);
      const components = buildStep3Components();

      await interaction.update({
        embeds: [embed],
        components: components
      });
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'setup:step2:wallet_submit') {
      const walletAddress = interaction.fields.getTextInputValue('wallet_address');
      const stopLossInput = interaction.fields.getTextInputValue('stop_loss_percent');


      if (!WalletAddress.isValid(walletAddress)) {
        await interaction.editReply({
          content: '❌ Invalid wallet address. Please provide a valid Solana address.'
        });
        return;
      }

      let stopLossPercent: number | undefined = undefined;
      if (stopLossInput) {
        const parsed = parseFloat(stopLossInput);
        if (isNaN(parsed) || parsed <= 0 || parsed > 100) {
          await interaction.editReply({
            content: '❌ Stop loss must be a number between 0 and 100.'
          });
          return;
        }
        stopLossPercent = parsed;
      }

      const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
        currentStep: 3,
        data: {
          walletAddress,
          stopLossPercent
        }
      });

      await interaction.editReply({
        content: '✅ Wallet configured successfully! Moving to timezone selection...'
      });

      const embed = buildStep3Embed(updatedSession);
      const components = buildStep3Components();

      try {
        await this.sessionService.sendNewAndDeletePrevious(
          session.guildId,
          session.userId,
          interaction.channel,
          [embed],
          components
        );
      } catch (error) {
        logger.error(`Failed to send new step 3 message for session ${session.userId}:`, error as Error);
        try {
          if (interaction.channel && 'send' in interaction.channel) {
            const newMessage = await interaction.channel.send({ embeds: [embed], components });
            this.sessionService.setLastMessageInfo(session.guildId, session.userId, newMessage.id, interaction.channelId!);
          }
        } catch (fallbackError) {
          logger.error('Failed to send fallback message', fallbackError as Error);
        }
      }
    }
  }

  private async handleStep3(interaction: StringSelectMenuInteraction, session: SetupSessionData): Promise<void> {
    const selectedTimezone = interaction.values[0] as Timezone;

    if (!TimezoneHelper.isValid(selectedTimezone)) {
      await interaction.editReply({ content: '❌ Invalid timezone selected.' });
      return;
    }

    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: 4,
      data: { timezone: selectedTimezone }
    });

    const embed = buildStep4Embed(updatedSession);
    const components = buildStep4Components();

    await interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

  private async handleStep4(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    if (interaction.customId === 'setup:step4:confirm') {
      await this.finalizeSetup(interaction, session);
    }
  }

  private async handleBack(interaction: ButtonInteraction, session: SetupSessionData, targetStep: number): Promise<void> {
    const updatedSession = this.sessionService.updateSession(session.guildId, session.userId, {
      currentStep: targetStep
    });

    let embed, components;

    switch (targetStep) {
      case 2:
        embed = buildStep2Embed(updatedSession);
        components = buildStep2Components(!!updatedSession.data.walletAddress);
        break;
      case 3:
        embed = buildStep3Embed(updatedSession);
        components = buildStep3Components();
        break;
      default:
        return;
    }

    await interaction.editReply({
      embeds: [embed],
      components: components
    });
  }

    private async handleCancel(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    this.sessionService.deleteSession(guildId, userId);

    await interaction.editReply({
      content: '❌ Setup cancelled. You can restart anytime with `/start`.',
      embeds: [],
      components: []
    });
  }

  private async finalizeSetup(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
        if (!this.sessionService.isSessionComplete(session)) {
      await interaction.editReply({
        content: '❌ Setup is incomplete. Please fill all required fields.'
      });
      return;
    }

    await this.initGuildUC.execute(session.guildId);

    await this.updateGuildUC.execute(session.guildId, {
      timezone: session.data.timezone!,
      globalChannelId: session.data.globalChannelId!,
      positionSizeDefaults: {
        walletAddress: session.data.walletAddress!,
        stopLossPercent: session.data.stopLossPercent || null
      }
    });

    this.sessionService.deleteSession(session.guildId, session.userId);

    const embed = buildStep5Embed();
    const components = buildStep5Components();

    await interaction.editReply({
      embeds: [embed],
      components: components
    });

    logger.info(`Setup completed for guild ${session.guildId} by user ${session.userId}`);
  }



  private async handleResume(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    const session = this.sessionService.getSession(guildId, userId);
    if (!session) {
      await interaction.editReply({
        content: '❌ No active session found. Please run `/start` to begin setup.',
        embeds: [],
        components: []
      });
      return;
    }

    await this.showCurrentStep(interaction, session);
    logger.info(`Resumed setup session for user ${userId} in guild ${guildId} at step ${session.currentStep}`);
  }

  private async handleRestart(interaction: ButtonInteraction, guildId: string, userId: string): Promise<void> {
    const newSession = this.sessionService.restartSession(guildId, userId);

    const embed = buildStep1Embed();
    const components = buildStep1Components();

    await interaction.editReply({
      embeds: [embed],
      components: components
    });

    logger.info(`Restarted setup session for user ${userId} in guild ${guildId}`);
  }

  private async showCurrentStep(interaction: ButtonInteraction, session: SetupSessionData): Promise<void> {
    let embed, components;

    switch (session.currentStep) {
      case 1:
        embed = buildStep1Embed();
        components = buildStep1Components();
        break;
      case 2:
        embed = buildStep2Embed(session);
        components = buildStep2Components(!!session.data.walletAddress);
        break;
      case 3:
        embed = buildStep3Embed(session);
        components = buildStep3Components();
        break;
      case 4:
        embed = buildStep4Embed(session);
        components = buildStep4Components();
        break;
      case 5:
        embed = buildStep5Embed();
        components = buildStep5Components();
        break;
      default:
        await interaction.editReply({
          content: '❌ Invalid session state. Please restart with `/start`.',
          embeds: [],
          components: []
        });
        this.sessionService.deleteSession(session.guildId, session.userId);
        return;
    }

    await interaction.editReply({
      embeds: [embed],
      components: components
    });
  }
}