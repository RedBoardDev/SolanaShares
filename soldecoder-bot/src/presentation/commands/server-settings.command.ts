import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { EnsureGuildExistsUseCase } from '@application/use-cases/ensure-guild-exists.use-case';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { buildServerSettingsEmbed, buildServerSettingsComponents } from '@presentation/ui/embeds/server-settings.embed';
import { logger } from '@helpers/logger';
import { runCommand } from '@presentation/commands/command-runner';

export const serverSettingsCommand = {
  data: new SlashCommandBuilder()
    .setName('server-settings')
    .setDescription('Configure server-wide settings (timezone, summaries, etc.)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 1 * 60_000,
      rateLimitKey: 'server-settings',
      requireGuild: true,
      ephemeral: true,
      logLabel: 'Error executing server settings command',
      fallbackMessage: '❌ An error occurred while loading server settings.',
      execute: async () => {
        const guildId = interaction.guildId!;
        const guildRepo = new DynamoGuildSettingsRepository();
        const ensureGuildUC = new EnsureGuildExistsUseCase(guildRepo);

        logger.debug(`Ensuring guild exists: ${guildId}`);
        const guildSettings = await ensureGuildUC.execute(guildId);

        let globalChannelName: string | undefined;
        if (guildSettings.globalChannelId) {
          const channel = interaction.guild!.channels.cache.get(guildSettings.globalChannelId);
          globalChannelName = channel?.name;
        }

        const embed = buildServerSettingsEmbed(guildSettings, globalChannelName);
        const components = buildServerSettingsComponents();

        await interaction.editReply({
          embeds: [embed],
          components: components
        });
      },
    });
  },
};
