import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { runCommand } from '@presentation/commands/command-runner';
import { buildBotGuideEmbed } from '@presentation/ui/embeds/bot-guide.embed';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display the complete bot guide and available features'),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 30 * 1000,
      rateLimitKey: 'help',
      requireGuild: false,
      ephemeral: true,
      logLabel: 'Help command failed to execute',
      fallbackMessage: '❌ An error occurred while displaying the guide.',
      execute: async () => {
        const embed = buildBotGuideEmbed();

        await interaction.editReply({
          embeds: [embed],
        });
      },
    });
  },
};
