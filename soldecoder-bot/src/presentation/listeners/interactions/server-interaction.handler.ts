import {
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ChannelSelectMenuInteraction,
  PermissionFlagsBits,
  type ModalSubmitInteraction,
} from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { UpdateGuildSettingsUseCase } from '@application/use-cases/update-guild-settings.use-case';
import { GetGuildSettingsUseCase } from '@application/use-cases/get-guild-settings.use-case';
import { EnsureGuildExistsUseCase } from '@application/use-cases/ensure-guild-exists.use-case';
import { buildServerSettingsEmbed, buildServerSettingsComponents } from '@presentation/ui/embeds/server-settings.embed';
import {
  buildTimezoneSelectComponent,
  buildChannelSelectComponent,
} from '@presentation/ui/components/server-select.component';
import { TimezoneHelper } from '@domain/value-objects/timezone';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import { buildWalletModal } from '@presentation/ui/modals/wallet.modal';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';
import { buildChannelListEmbed, buildChannelListComponents } from '@presentation/ui/embeds/channel-list.embed';
import { PermissionValidatorService } from '@infrastructure/services/permission-validator.service';
import {
  sendInteractionError,
  sendSimpleInteractionError,
  sendEarlyInteractionError,
} from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';

export class ServerInteractionHandler {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly updateGuildUC: UpdateGuildSettingsUseCase;
  private readonly getGuildUC: GetGuildSettingsUseCase;
  private readonly ensureGuildUC: EnsureGuildExistsUseCase;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly getChannelsUC: GetGuildChannelsUseCase;
  private readonly permissionValidator: PermissionValidatorService;

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.updateGuildUC = new UpdateGuildSettingsUseCase(this.guildRepo);
    this.getGuildUC = new GetGuildSettingsUseCase(this.guildRepo);
    this.ensureGuildUC = new EnsureGuildExistsUseCase(this.guildRepo);
    this.channelRepo = new DynamoChannelConfigRepository();
    this.getChannelsUC = new GetGuildChannelsUseCase(this.channelRepo);
    this.permissionValidator = new PermissionValidatorService();
  }

  async handleInteraction(
    interaction:
      | ButtonInteraction
      | StringSelectMenuInteraction
      | ChannelSelectMenuInteraction
      | ModalSubmitInteraction
      | any,
  ): Promise<void> {
    if (!interaction.guildId) {
      await sendEarlyInteractionError(interaction, '❌ This can only be used in a server.', {
        guildId: interaction.guildId,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await sendEarlyInteractionError(interaction, '❌ You need Administrator permissions to use this.', {
        guildId: interaction.guildId,
      });
      return;
    }

    try {
      const customId = interaction.customId;

      if (customId.startsWith('server:timezone:select')) {
        await this.handleTimezoneSelect(interaction as ButtonInteraction);
      } else if (customId.startsWith('server:timezone:set')) {
        await this.handleTimezoneSet(interaction as StringSelectMenuInteraction);
      } else if (customId.startsWith('server:channel:select')) {
        await this.handleChannelSelect(interaction as ButtonInteraction);
      } else if (customId.startsWith('server:channel:set')) {
        await this.handleChannelSet(interaction as ChannelSelectMenuInteraction);
      } else if (customId.startsWith('server:toggle:')) {
        await this.handleToggle(interaction as ButtonInteraction);
      } else if (customId.startsWith('server:channels:manage')) {
        await this.handleChannelsManage(interaction as ButtonInteraction);
      } else if (customId.startsWith('server:position-size-defaults:openModal')) {
        await this.handlePositionSizeDefaultsOpenModal(interaction as ButtonInteraction);
      } else if (customId.startsWith('server:position-size-defaults:submit')) {
        await this.handlePositionSizeDefaultsSubmit(interaction as ModalSubmitInteraction);
      }
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'server_interaction',
          customId: interaction.customId,
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: An error occurred while processing your request. Please try again later.',
      );
    }
  }

  private async handlePositionSizeDefaultsOpenModal(interaction: ButtonInteraction): Promise<void> {
    const current = await this.getGuildUC.execute(interaction.guildId!);
    const modal = buildWalletModal(
      current?.positionSizeDefaults.walletAddress ?? null,
      current?.positionSizeDefaults.stopLossPercent ?? null,
    );
    await interaction.showModal(modal);
  }

  private async handlePositionSizeDefaultsSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const walletInput = interaction.fields.getTextInputValue('position_size_wallet')?.trim();
    const slInput = interaction.fields.getTextInputValue('position_size_sl')?.trim();

    await interaction.deferUpdate();

    try {
      let validatedWallet: string | null = null;
      if (walletInput) {
        if (!WalletAddress.isValid(walletInput)) {
          await sendSimpleInteractionError(
            interaction,
            '❌ **Invalid Wallet Address**: Please provide a valid Solana address.',
            {
              walletInput,
              guildId: interaction.guildId,
              operation: 'wallet_validation',
            },
          );
          return;
        }
        validatedWallet = WalletAddress.create(walletInput).value;
      }

      let validatedSl: number | null = null;
      if (slInput) {
        const num = Number(slInput);
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          await sendSimpleInteractionError(
            interaction,
            '❌ **Invalid Stop Loss**: Stop loss must be a number between 0 and 100.',
            {
              slInput,
              guildId: interaction.guildId,
              operation: 'stop_loss_validation',
            },
          );
          return;
        }
        validatedSl = Math.round(num * 100) / 100;
      }

      await this.updateGuildUC.execute(interaction.guildId!, {
        positionSizeDefaults: {
          walletAddress: validatedWallet,
          stopLossPercent: validatedSl,
        },
      });

      await this.refreshServerSettings(interaction as any);
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'set_position_size_defaults',
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to update position size defaults. Please try again later.',
      );
    }
  }

  private async handleTimezoneSelect(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const timezoneComponent = buildTimezoneSelectComponent();
    await interaction.editReply({
      content: '🌍 Select your server timezone:',
      components: [timezoneComponent],
    });
  }

  private async handleTimezoneSet(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedTimezone = interaction.values[0];

    await interaction.deferUpdate();

    try {
      if (!TimezoneHelper.isValid(selectedTimezone)) {
        await sendSimpleInteractionError(interaction, '❌ Invalid timezone selected.', {
          selectedTimezone,
          guildId: interaction.guildId,
        });
        return;
      }

      await this.updateGuildUC.execute(interaction.guildId!, { timezone: selectedTimezone });

      await this.refreshServerSettings(interaction);
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'update_timezone',
          selectedTimezone,
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to update timezone. Please try again later.',
      );
    }
  }

  private async handleChannelSelect(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    try {
      logger.debug('Building channel select component');
      const channelComponent = buildChannelSelectComponent();
      logger.debug('Channel component built successfully');

      await interaction.editReply({
        content: '📝 Select a channel for summaries and position display:',
        components: [channelComponent],
      });

      logger.debug('Channel select displayed successfully');
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'display_channel_selection',
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to display channel selection. Please try again later.',
      );
    }
  }

  private async handleChannelSet(interaction: ChannelSelectMenuInteraction): Promise<void> {
    const selectedChannelId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      await this.permissionValidator.validateChannelAccess(interaction.guild!, selectedChannelId);

      logger.debug(`Setting summary channel to ${selectedChannelId} for guild ${interaction.guildId}`);
      await this.updateGuildUC.execute(interaction.guildId!, { globalChannelId: selectedChannelId });
      logger.debug('Summary channel updated successfully');

      await this.refreshServerSettings(interaction);
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'update_summary_channel',
          selectedChannelId,
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to update summary channel. Please try again later.',
      );
    }
  }

  private async handleToggle(interaction: ButtonInteraction): Promise<void> {
    const action = interaction.customId.split(':')[2];

    await interaction.deferUpdate();

    try {
      const currentSettings = await this.getGuildUC.execute(interaction.guildId!);
      if (!currentSettings) {
        await sendSimpleInteractionError(interaction, '❌ Guild settings not found.', {
          action,
          guildId: interaction.guildId,
        });
        return;
      }

      let updates: any = {};

      if (action === 'positionDisplay') {
        updates = { positionDisplayEnabled: !currentSettings.positionDisplayEnabled };
      } else if (action === 'autoDeleteWarnings') {
        updates = { autoDeleteWarnings: !currentSettings.autoDeleteWarnings };
      } else if (action === 'forwardTpSl') {
        updates = { forwardTpSl: !currentSettings.forwardTpSl };
      } else if (action === 'dailySummary') {
        updates = { summaryPreferences: { dailySummary: !currentSettings.summaryPreferences.dailySummary } };
      } else if (action === 'weeklySummary') {
        updates = { summaryPreferences: { weeklySummary: !currentSettings.summaryPreferences.weeklySummary } };
      } else if (action === 'monthlySummary') {
        updates = { summaryPreferences: { monthlySummary: !currentSettings.summaryPreferences.monthlySummary } };
      } else {
        throw new Error(`Unknown toggle action: ${action}`);
      }

      await this.updateGuildUC.execute(interaction.guildId!, updates);

      await this.refreshServerSettings(interaction);
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'toggle_setting',
          action,
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to update setting. Please try again later.',
      );
    }
  }

  private async handleChannelsManage(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    try {
      const channels = await this.getChannelsUC.execute(interaction.guildId!);

      const guildChannels = interaction
        .guild!.channels.cache.filter((ch) => ch.type === 0)
        .map((ch) => ({ id: ch.id, name: ch.name }));

      const embed = buildChannelListEmbed(channels);
      const components = buildChannelListComponents(channels, guildChannels);

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      await sendInteractionError(
        interaction,
        error,
        {
          operation: 'load_channel_settings',
          guildId: interaction.guildId,
        },
        '❌ **Unexpected Error**: Failed to load channel settings. Please try again later.',
      );
    }
  }

  private async refreshServerSettings(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction,
  ): Promise<void> {
    let guildSettings = await this.getGuildUC.execute(interaction.guildId!);

    if (!guildSettings) {
      guildSettings = await this.ensureGuildUC.execute(interaction.guildId!);
    }

    let globalChannelName: string | undefined;
    if (guildSettings.globalChannelId) {
      const channel = interaction.guild!.channels.cache.get(guildSettings.globalChannelId);
      globalChannelName = channel?.name;
    }

    const embed = buildServerSettingsEmbed(guildSettings, globalChannelName);
    const components = buildServerSettingsComponents(guildSettings);

    await interaction.editReply({ embeds: [embed], components });
  }
}
