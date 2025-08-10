import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { GetGuildSettingsUseCase } from '@application/use-cases/get-guild-settings.use-case';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { SetupSessionService } from '@infrastructure/services/setup-session.service';
import { buildStep1Embed, buildStep1Components, buildResumeSetupEmbed, buildResumeSetupComponents } from '@presentation/ui/embeds/setup-flow.embed';
import { logger } from '@helpers/logger';
import { runCommand } from '@presentation/commands/command-runner';
import { InvalidCommandUsageError } from '@presentation/commands/command-errors';

export const startCommand = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Initialize the bot setup for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 2 * 60_000,
      rateLimitKey: 'start',
      requireGuild: false,
      ephemeral: true,
      logLabel: 'Error executing start command',
      fallbackMessage: '❌ An error occurred while starting the setup process.',
      execute: async () => {
        if (!interaction.guildId || !interaction.guild) {
          throw new InvalidCommandUsageError('❌ This command can only be used in a server.');
        }

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const guildRepo = new DynamoGuildSettingsRepository();
        const getGuildSettingsUC = new GetGuildSettingsUseCase(guildRepo);

        logger.debug(`Checking if guild ${guildId} already exists`);
        const existingSettings = await getGuildSettingsUC.execute(guildId);

        if (existingSettings) {
          throw new InvalidCommandUsageError('❌ This server is already configured. Use `/server-settings` to modify settings.');
        }

        const sessionService = SetupSessionService.getInstance();
        let session = sessionService.getSession(guildId, userId);

        if (session) {
          const embed = buildResumeSetupEmbed(session);
          const components = buildResumeSetupComponents();

          const reply = await interaction.editReply({
            embeds: [embed],
            components: components
          });

          sessionService.setLastMessageInfo(guildId, userId, reply.id, interaction.channelId!);
        } else {
          session = sessionService.createSession(guildId, userId);

          const embed = buildStep1Embed();
          const components = buildStep1Components();

          const reply = await interaction.editReply({
            embeds: [embed],
            components: components
          });

          sessionService.setLastMessageInfo(guildId, userId, reply.id, interaction.channelId!);
        }
      },
    });
  },
};
