import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  PermissionFlagsBits,
  ChannelType,
  ModalSubmitInteraction,
} from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { UpdateGuildSettingsUseCase } from '@application/use-cases/update-guild-settings.use-case';
import { GetGuildSettingsUseCase } from '@application/use-cases/get-guild-settings.use-case';
import { EnsureGuildExistsUseCase } from '@application/use-cases/ensure-guild-exists.use-case';
import { buildServerSettingsEmbed, buildServerSettingsComponents } from '@presentation/ui/embeds/server-settings.embed';
import { buildTimezoneSelectComponent, buildChannelSelectComponent, getTimezoneDisplayName } from '@presentation/ui/components/server-select.component';
import { TimezoneHelper } from '@domain/value-objects/timezone';
import { logger } from '@helpers/logger';

export class ServerInteractionHandler {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly updateGuildUC: UpdateGuildSettingsUseCase;
  private readonly getGuildUC: GetGuildSettingsUseCase;
  private readonly ensureGuildUC: EnsureGuildExistsUseCase;

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.updateGuildUC = new UpdateGuildSettingsUseCase(this.guildRepo);
    this.getGuildUC = new GetGuildSettingsUseCase(this.guildRepo);
    this.ensureGuildUC = new EnsureGuildExistsUseCase(this.guildRepo);
  }

  async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction | any): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ This can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ You need Administrator permissions to use this.', ephemeral: true });
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
      logger.error('Error handling server interaction', error as Error, { customId: interaction.customId });

      const content = '❌ An error occurred while processing your request.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  }

  private async handlePositionSizeDefaultsOpenModal(interaction: ButtonInteraction): Promise<void> {
    const current = await this.getGuildUC.execute(interaction.guildId!);
    const { buildWalletModal } = await import('@presentation/ui/modals/wallet.modal');
    const modal = buildWalletModal(current?.positionSizeDefaults.walletAddress ?? null, current?.positionSizeDefaults.stopLossPercent ?? null);
    await interaction.showModal(modal);
  }

  private async handlePositionSizeDefaultsSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const walletInput = interaction.fields.getTextInputValue('position_size_wallet')?.trim();
    const slInput = interaction.fields.getTextInputValue('position_size_sl')?.trim();

    await interaction.deferUpdate();

    try {
      let validatedWallet: string | null = null;
      if (walletInput) {
        const { WalletAddress } = await import('@domain/value-objects/wallet-address');
        validatedWallet = WalletAddress.create(walletInput).value;
      }

      let validatedSl: number | null = null;
      if (slInput) {
        const num = Number(slInput);
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          throw new Error('Stop Loss must be a number between 0 and 100');
        }
        validatedSl = Math.round(num * 100) / 100;
      }

      await this.updateGuildUC.execute(interaction.guildId!, {
        positionSizeDefaults: {
          walletAddress: validatedWallet,
          stopLossPercent: validatedSl,
        }
      });

      await this.refreshServerSettings(interaction as any);
    } catch (error) {
      await interaction.editReply({ content: `❌ Invalid defaults: ${(error as Error).message}` });
    }
  }

  private async handleTimezoneSelect(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const timezoneComponent = buildTimezoneSelectComponent();
    await interaction.editReply({
      content: '🌍 Select your server timezone:',
      components: [timezoneComponent]
    });
  }

  private async handleTimezoneSet(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedTimezone = interaction.values[0];

    await interaction.deferUpdate();

    try {
      if (!TimezoneHelper.isValid(selectedTimezone)) {
        await interaction.editReply({ content: '❌ Invalid timezone selected.' });
        return;
      }

      await this.updateGuildUC.execute(interaction.guildId!, { timezone: selectedTimezone });

      await this.refreshServerSettings(interaction);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to update timezone: ${(error as Error).message}`
      });
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
        components: [channelComponent]
      });

      logger.debug('Channel select displayed successfully');
    } catch (error) {
      logger.error('Error in handleChannelSelect', error as Error);
      await interaction.editReply({
        content: '❌ Failed to display channel selection.'
      });
    }
  }

  private async handleChannelSet(interaction: ChannelSelectMenuInteraction): Promise<void> {
    const selectedChannelId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      logger.debug(`Setting summary channel to ${selectedChannelId} for guild ${interaction.guildId}`);
      await this.updateGuildUC.execute(interaction.guildId!, { globalChannelId: selectedChannelId });
      logger.debug('Summary channel updated successfully');

      await this.refreshServerSettings(interaction);
    } catch (error) {
      logger.error('Error in handleChannelSet', error as Error);
      await interaction.editReply({
        content: `❌ Failed to update channel: ${(error as Error).message}`
      });
    }
  }

  private async handleToggle(interaction: ButtonInteraction): Promise<void> {
    const action = interaction.customId.split(':')[2];

    await interaction.deferUpdate();

    try {
      const currentSettings = await this.getGuildUC.execute(interaction.guildId!);
      if (!currentSettings) {
        await interaction.editReply({ content: '❌ Guild settings not found.' });
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
      await interaction.editReply({
        content: `❌ Failed to update setting: ${(error as Error).message}`
      });
    }
  }

  private async handleChannelsManage(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    try {
      const channelRepo = new (await import('@infrastructure/repositories/dynamo-channel-config.repository')).DynamoChannelConfigRepository();
      const getChannelsUC = new (await import('@application/use-cases/get-guild-channels.use-case')).GetGuildChannelsUseCase(channelRepo);

      const channels = await getChannelsUC.execute(interaction.guildId!);

      const guildChannels = interaction.guild!.channels.cache
        .filter(ch => ch.type === 0)
        .map(ch => ({ id: ch.id, name: ch.name }));

      const { buildChannelListEmbed, buildChannelListComponents } = await import('@presentation/ui/embeds/channel-list.embed');
      const embed = buildChannelListEmbed(channels);
      const components = buildChannelListComponents(channels, guildChannels);

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Failed to load channel settings.'
      });
    }
  }

  private async refreshServerSettings(interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
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
    const components = buildServerSettingsComponents();

    await interaction.editReply({ embeds: [embed], components });
  }
}
