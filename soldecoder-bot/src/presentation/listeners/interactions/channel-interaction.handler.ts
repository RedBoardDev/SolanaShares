import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { AddChannelConfigUseCase } from '@application/use-cases/add-channel-config.use-case';
import { RemoveChannelConfigUseCase } from '@application/use-cases/remove-channel-config.use-case';
import { UpdateChannelConfigUseCase } from '@application/use-cases/update-channel-config.use-case';
import { GetChannelConfigUseCase } from '@application/use-cases/get-channel-config.use-case';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';
import { buildChannelListEmbed, buildChannelListComponents } from '@presentation/ui/embeds/channel-list.embed';
import { buildChannelDetailEmbed, buildChannelDetailComponents } from '@presentation/ui/embeds/channel-detail.embed';
import { buildThresholdModal, validateThreshold } from '@presentation/ui/modals/threshold.modal';
import { buildUserSelectComponent, buildRoleSelectComponent } from '@presentation/ui/components/tag-select.component';
import { logger } from '@helpers/logger';

export class ChannelInteractionHandler {
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly addChannelUC: AddChannelConfigUseCase;
  private readonly removeChannelUC: RemoveChannelConfigUseCase;
  private readonly updateChannelUC: UpdateChannelConfigUseCase;
  private readonly getChannelUC: GetChannelConfigUseCase;
  private readonly getGuildChannelsUC: GetGuildChannelsUseCase;

  constructor() {
    this.channelRepo = new DynamoChannelConfigRepository();
    this.addChannelUC = new AddChannelConfigUseCase(this.channelRepo);
    this.removeChannelUC = new RemoveChannelConfigUseCase(this.channelRepo);
    this.updateChannelUC = new UpdateChannelConfigUseCase(this.channelRepo);
    this.getChannelUC = new GetChannelConfigUseCase(this.channelRepo);
    this.getGuildChannelsUC = new GetGuildChannelsUseCase(this.channelRepo);
  }

  async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction): Promise<void> {
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

      if (customId.startsWith('channels:show_add')) {
        await this.handleShowAddDropdown(interaction as ButtonInteraction);
      } else if (customId.startsWith('channels:show_remove')) {
        await this.handleShowRemoveDropdown(interaction as ButtonInteraction);
      } else if (customId.startsWith('channels:add')) {
        await this.handleAddChannel(interaction as ChannelSelectMenuInteraction);
      } else if (customId.startsWith('channels:remove')) {
        await this.handleRemoveChannel(interaction as StringSelectMenuInteraction);
      } else if (customId.startsWith('channels:back')) {
        await this.handleBackToChannels(interaction as ButtonInteraction);
      } else if (customId.startsWith('channel:config:')) {
        await this.handleChannelConfig(interaction as ButtonInteraction);
      } else if (customId.startsWith('channel:toggle:')) {
        await this.handleToggle(interaction as ButtonInteraction);
      } else if (customId.startsWith('channel:threshold:')) {
        await this.handleThresholdModal(interaction as ButtonInteraction);
      } else if (customId.startsWith('threshold:submit:')) {
        await this.handleThresholdSubmit(interaction as ModalSubmitInteraction);
      } else if (customId.startsWith('channel:tag:')) {
        await this.handleTagAction(interaction as ButtonInteraction);
      } else if (customId.startsWith('tag:user:')) {
        await this.handleUserTagSelect(interaction as UserSelectMenuInteraction);
      } else if (customId.startsWith('tag:role:')) {
        await this.handleRoleTagSelect(interaction as RoleSelectMenuInteraction);
      }
    } catch (error) {
      logger.error('Error handling channel interaction', error as Error, { customId: interaction.customId });

      const content = '❌ An error occurred while processing your request.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  }

  private async handleShowAddDropdown(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await this.refreshChannelsList(interaction, true, false);
  }

  private async handleShowRemoveDropdown(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await this.refreshChannelsList(interaction, false, true);
  }

  private async handleAddChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    const channelId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      const existingConfig = await this.getChannelUC.execute(channelId);
      if (existingConfig) {
        await interaction.editReply({
          content: `❌ Channel "${interaction.guild!.channels.cache.get(channelId)?.name || 'Unknown'}" is already configured.`,
          embeds: [],
          components: []
        });
        return;
      }

      await this.addChannelUC.execute(channelId, interaction.guildId!);
      await this.refreshChannelsList(interaction);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to add channel: ${(error as Error).message}`,
        embeds: [],
        components: []
      });
    }
  }

  private async handleRemoveChannel(interaction: StringSelectMenuInteraction): Promise<void> {
    const channelId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      await this.removeChannelUC.execute(channelId);
      await this.refreshChannelsList(interaction);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to remove channel: ${(error as Error).message}`,
        embeds: [],
        components: []
      });
    }
  }

  private async handleBackToChannels(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    await this.refreshChannelsList(interaction);
  }

  private async handleChannelConfig(interaction: ButtonInteraction | ModalSubmitInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction, channelId?: string): Promise<void> {
    if (!channelId) {
      const parts = interaction.customId.split(':');
      if (parts[0] === 'channel' && parts[1] === 'config') {
        channelId = parts[2];
      } else {
        throw new Error('Unable to extract channelId from interaction');
      }
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    try {
      const channelConfig = await this.getChannelUC.execute(channelId);
      if (!channelConfig) {
        await interaction.editReply({ content: '❌ Channel configuration not found.' });
        return;
      }

      const channel = interaction.guild!.channels.cache.get(channelId);
      const channelName = channel?.name || 'Unknown';

      let tagDisplayName: string | undefined;
      if (channelConfig.tagType === 'USER' && channelConfig.tagId) {
        tagDisplayName = `<@${channelConfig.tagId}>`;
      } else if (channelConfig.tagType === 'ROLE' && channelConfig.tagId) {
        tagDisplayName = `<@&${channelConfig.tagId}>`;
      }

      const embed = buildChannelDetailEmbed(channelConfig, channelName, tagDisplayName);
      const components = buildChannelDetailComponents(channelConfig);

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to load channel configuration: ${(error as Error).message}`
      });
    }
  }

  private async handleToggle(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[2];
    const channelId = parts[3];

    await interaction.deferUpdate();

    try {
      const currentConfig = await this.getChannelUC.execute(channelId);
      if (!currentConfig) {
        await interaction.editReply({ content: '❌ Channel configuration not found.' });
        return;
      }

      let actualUpdates;
      if (action === 'notifyOnClose') {
        actualUpdates = { notifyOnClose: !currentConfig.notifyOnClose };
      } else if (action === 'image') {
        actualUpdates = { image: !currentConfig.image };
      } else if (action === 'pin') {
        actualUpdates = { pin: !currentConfig.pin };
      } else {
        throw new Error(`Unknown toggle action: ${action}`);
      }

      await this.updateChannelUC.execute(channelId, actualUpdates);

      await this.handleChannelConfig(interaction, channelId);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to update setting: ${(error as Error).message}`
      });
    }
  }

  private async handleThresholdModal(interaction: ButtonInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[2];

    const currentConfig = await this.getChannelUC.execute(channelId);
    if (!currentConfig) {
      await interaction.reply({ content: '❌ Channel configuration not found.', ephemeral: true });
      return;
    }

    const modal = buildThresholdModal(channelId, currentConfig.threshold);
    await interaction.showModal(modal);
  }

  private async handleThresholdSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[2];
    const thresholdInput = interaction.fields.getTextInputValue('threshold_value');

    await interaction.deferUpdate();

    try {
      const validation = validateThreshold(thresholdInput);
      if (!validation.isValid) {
        await interaction.editReply({ content: `❌ ${validation.error}` });
        return;
      }

      await this.updateChannelUC.execute(channelId, { threshold: validation.value });

      await this.handleChannelConfig(interaction, channelId);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to update threshold: ${(error as Error).message}`
      });
    }
  }

  private async handleTagAction(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[2];
    const channelId = parts[3];

    await interaction.deferUpdate();

    try {
      if (action === 'clear') {
        await this.updateChannelUC.execute(channelId, { tagType: 'NONE', tagId: '' });
        await this.handleChannelConfig(interaction, channelId);
      } else if (action === 'select_user') {
        const userSelectComponent = buildUserSelectComponent(channelId);
        await interaction.editReply({
          content: '👤 Select a user to tag when notifications are sent:',
          components: [userSelectComponent]
        });
      } else if (action === 'select_role') {
        // TODO: add role select component
        const roleSelectComponent = buildRoleSelectComponent(channelId);
        await interaction.editReply({
          content: '👥 Select a role to tag when notifications are sent:',
          components: [roleSelectComponent]
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to update tag: ${(error as Error).message}`
      });
    }
  }

  private async handleUserTagSelect(interaction: UserSelectMenuInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[2];
    const selectedUserId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      await this.updateChannelUC.execute(channelId, {
        tagType: 'USER',
        tagId: selectedUserId
      });

      await this.handleChannelConfig(interaction, channelId);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to set user tag: ${(error as Error).message}`
      });
    }
  }

  private async handleRoleTagSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[2];
    const selectedRoleId = interaction.values[0];

    await interaction.deferUpdate();

    try {
      await this.updateChannelUC.execute(channelId, {
        tagType: 'ROLE',
        tagId: selectedRoleId
      });

      await this.handleChannelConfig(interaction, channelId);
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to set role tag: ${(error as Error).message}`
      });
    }
  }

  private async refreshChannelsList(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction,
    showAddDropdown = false,
    showRemoveDropdown = false
  ): Promise<void> {
    const channels = await this.getGuildChannelsUC.execute(interaction.guildId!);

    const guildChannels = interaction.guild!.channels.cache
      .filter(ch => ch.type === ChannelType.GuildText)
      .map(ch => ({ id: ch.id, name: ch.name }));

    const embed = buildChannelListEmbed(channels);
    const components = buildChannelListComponents(channels, guildChannels, showAddDropdown, showRemoveDropdown);

    await interaction.editReply({ embeds: [embed], components });
  }
}
