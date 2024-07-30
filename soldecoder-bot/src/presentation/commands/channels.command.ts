import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { EnsureGuildExistsUseCase } from '@application/use-cases/ensure-guild-exists.use-case';
import { GetGuildChannelsUseCase } from '@application/use-cases/get-guild-channels.use-case';
import { buildChannelListEmbed, buildChannelListComponents } from '@presentation/ui/embeds/channel-list.embed';
import { runCommand } from '@presentation/commands/command-runner';

export const followedChannelsCommand = {
  data: new SlashCommandBuilder()
    .setName('followed-channels')
    .setDescription('Displays the followed channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 1 * 60_000,
      rateLimitKey: 'followed-channels',
      requireGuild: true,
      ephemeral: true,
      logLabel: 'followedChannelsCommand failed to execute',
      fallbackMessage: '❌ An error occurred while retrieving followed channels.',
      execute: async () => {
        const guildId = interaction.guildId!;
        const guildRepo = new DynamoGuildSettingsRepository();
        const channelRepo = new DynamoChannelConfigRepository();

        const ensureGuildUC = new EnsureGuildExistsUseCase(guildRepo);
        const guildSettings = await ensureGuildUC.execute(guildId);

        const getChannelsUC = new GetGuildChannelsUseCase(channelRepo);
        const channels = await getChannelsUC.execute(guildId);

        const guildChannels = interaction.guild!.channels.cache
          .filter(ch => ch.type === ChannelType.GuildText)
          .map(ch => ({ id: ch.id, name: ch.name }));

        const embed = buildChannelListEmbed(channels);
        const components = buildChannelListComponents(channels, guildChannels);

        await interaction.editReply({ embeds: [embed], components });
      },
    });
  },
};
