import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ChannelSelectMenuInteraction,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { SetupSessionService } from '@infrastructure/services/setup-session.service';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { InitGuildSettingsUseCase } from '@application/use-cases/init-guild-settings.use-case';
import { UpdateGuildSettingsUseCase } from '@application/use-cases/update-guild-settings.use-case';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';
import { PermissionValidatorService } from '@infrastructure/services/permission-validator.service';
import {
  sendInteractionError,
  sendSimpleInteractionError,
  sendEarlyInteractionError,
} from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

// Import step handlers
import { SetupStep1Handler } from './steps/setup-step1.handler';
import { SetupStep2Handler } from './steps/setup-step2.handler';
import { SetupStep3Handler } from './steps/setup-step3.handler';
import { SetupStep4Handler } from './steps/setup-step4.handler';
import { SetupSessionManager } from './setup-session.manager';

type SetupInteractionType =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | ModalSubmitInteraction;

/**
 * Main setup interaction handler that routes interactions to appropriate step handlers
 * Provides centralized error handling and permission validation
 */
export class SetupInteractionHandler {
  private readonly sessionService: SetupSessionService;
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly permissionValidator: PermissionValidatorService;

  // Use Cases
  private readonly initGuildUC: InitGuildSettingsUseCase;
  private readonly updateGuildUC: UpdateGuildSettingsUseCase;
  private readonly getChannelsUC: GetGuildChannelsUseCase;

  // Step Handlers
  private readonly step1Handler: SetupStep1Handler;
  private readonly step2Handler: SetupStep2Handler;
  private readonly step3Handler: SetupStep3Handler;
  private readonly step4Handler: SetupStep4Handler;
  private readonly sessionManager: SetupSessionManager;

  constructor() {
    // Core services
    this.sessionService = SetupSessionService.getInstance();
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.permissionValidator = new PermissionValidatorService();

    // Use cases
    this.initGuildUC = new InitGuildSettingsUseCase(this.guildRepo);
    this.updateGuildUC = new UpdateGuildSettingsUseCase(this.guildRepo);
    this.getChannelsUC = new GetGuildChannelsUseCase(this.channelRepo);

    // Step handlers with dependency injection
    this.step1Handler = new SetupStep1Handler(this.sessionService, this.permissionValidator);

    this.step2Handler = new SetupStep2Handler(this.sessionService);

    this.step3Handler = new SetupStep3Handler(this.sessionService);

    this.step4Handler = new SetupStep4Handler(this.sessionService, this.initGuildUC, this.updateGuildUC);

    this.sessionManager = new SetupSessionManager(this.sessionService);
  }

  async handleInteraction(interaction: SetupInteractionType | any): Promise<void> {
    // Early validation with ephemeral errors
    if (!interaction.guildId) {
      await sendEarlyInteractionError(interaction, '❌ This can only be used in a server.', {
        operation: 'setup_validation',
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await sendEarlyInteractionError(interaction, '❌ You need Administrator permissions to use this.', {
        guildId: interaction.guildId,
        operation: 'setup_validation',
      });
      return;
    }

    const customId = interaction.customId;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Handle modal specially (no defer)
    if (customId === 'setup:step2:wallet_modal') {
      // Modal interactions are handled differently
    } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
      await interaction.deferUpdate();
    } else if (interaction.isModalSubmit()) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      await this.routeInteraction(interaction, customId, guildId, userId);
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'setup_interaction',
          customId,
          guildId,
          userId,
        },
        '❌ **Setup Error**: An error occurred during setup. Please try again or restart with `/start`.',
      );
    }
  }

  private async routeInteraction(
    interaction: SetupInteractionType,
    customId: string,
    guildId: string,
    userId: string,
  ): Promise<void> {
    // Handle session management interactions
    if (customId === 'setup:cancel') {
      if (interaction.isButton()) {
        await this.sessionManager.handleCancel(interaction, guildId, userId);
      }
      return;
    }

    if (customId === 'setup:resume') {
      if (interaction.isButton()) {
        await this.sessionManager.handleResume(interaction, guildId, userId);
      }
      return;
    }

    if (customId === 'setup:restart') {
      if (interaction.isButton()) {
        await this.sessionManager.handleRestart(interaction, guildId, userId);
      }
      return;
    }

    // Validate session exists for step interactions
    const session = this.sessionService.getSession(guildId, userId);
    if (!session) {
      await sendSimpleInteractionError(
        interaction,
        '❌ No active setup session found. Please run `/start` to begin setup.',
        { guildId, userId, operation: 'session_validation' },
      );
      return;
    }

    // Validate session ownership
    if (!this.sessionService.validateSessionOwner(guildId, userId, session.userId)) {
      await sendSimpleInteractionError(interaction, '❌ You are not authorized to interact with this setup session.', {
        guildId,
        userId,
        sessionOwner: session.userId,
        operation: 'session_authorization',
      });
      return;
    }

    // Route to appropriate step handler
    if (customId.startsWith('setup:step1:')) {
      if (interaction.isChannelSelectMenu()) {
        await this.step1Handler.handle(interaction, session);
      }
    } else if (customId.startsWith('setup:step2:')) {
      if (interaction.isButton() || interaction.isModalSubmit()) {
        await this.step2Handler.handle(interaction, session);
      }
    } else if (customId.startsWith('setup:step3:')) {
      if (interaction.isStringSelectMenu()) {
        await this.step3Handler.handle(interaction, session);
      }
    } else if (customId.startsWith('setup:step4:')) {
      if (interaction.isButton()) {
        await this.step4Handler.handle(interaction, session);
      }
    } else if (customId.startsWith('setup:back:')) {
      if (interaction.isButton()) {
        const targetStep = Number.parseInt(customId.split(':')[2]);
        await this.sessionManager.handleBack(interaction, session, targetStep);
      }
    } else {
      logger.warn(`Unknown setup interaction: ${customId}`, {
        guildId,
        userId,
        customId,
      });
    }
  }
}
