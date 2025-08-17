import type { ButtonInteraction } from 'discord.js';
import { buildServerSettingsEmbed, buildServerSettingsComponents } from '@presentation/ui/embeds/server-settings.embed';
import { buildChannelListEmbed, buildChannelListComponents } from '@presentation/ui/embeds/channel-list.embed';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';
import { sendSimpleInteractionError } from '@presentation/helpers/interaction-error.helper';
import { logger } from '@helpers/logger';
import { ChannelType } from 'discord.js';

export class GuideInteractionHandler {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly getChannelsUC: GetGuildChannelsUseCase;

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.getChannelsUC = new GetGuildChannelsUseCase(this.channelRepo);
  }

  async handleInteraction(interaction: ButtonInteraction | any): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ This can only be used in a server.', flags: 64 });
      return;
    }

    const customId = interaction.customId;
    const guildId = interaction.guildId;

    try {
      if (customId === 'guide:view_settings') {
        await this.handleViewSettings(interaction, guildId);
      } else if (customId === 'guide:setup_channels') {
        await this.handleSetupChannels(interaction, guildId);
      } else {
        logger.warn(`Unknown guide interaction: ${customId}`);
      }
    } catch (error) {
      logger.error(`Error handling guide interaction: ${customId}`, error as Error);

      try {
        if (interaction.replied || interaction.deferred) {
          await sendSimpleInteractionError(interaction, '❌ An error occurred. Please try again.', {
            guildId: interaction.guildId,
            customId,
          });
        } else {
          await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
        }
      } catch (replyError) {
        logger.error('Failed to send error response', replyError as Error);
      }
    }
  }

  private async handleViewSettings(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const guildSettings = await this.guildRepo.getByGuildId(guildId);
    if (!guildSettings) {
      await sendSimpleInteractionError(
        interaction,
        '❌ Guild settings not found. Please run `/start` to configure your server.',
        {
          guildId: interaction.guildId,
          operation: 'view_settings',
        },
      );
      return;
    }

    let globalChannelName: string | undefined;
    if (guildSettings.globalChannelId) {
      const channel = interaction.guild!.channels.cache.get(guildSettings.globalChannelId);
      globalChannelName = channel?.name;
    }

    const embed = buildServerSettingsEmbed(guildSettings, globalChannelName);
    const components = buildServerSettingsComponents(guildSettings);

    await interaction.update({
      embeds: [embed],
      components: components,
    });
  }

  private async handleSetupChannels(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const channels = await this.getChannelsUC.execute(guildId);

    const guildChannels = interaction
      .guild!.channels.cache.filter((ch) => ch.type === ChannelType.GuildText)
      .map((ch) => ({ id: ch.id, name: ch.name }));

    const embed = buildChannelListEmbed(channels);
    const components = buildChannelListComponents(channels, guildChannels);

    await interaction.update({
      embeds: [embed],
      components: components,
    });
  }
}
