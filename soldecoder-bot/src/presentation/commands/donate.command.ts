import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { runCommand } from '@presentation/commands/command-runner';
import { buildDonateEmbed } from '@presentation/ui/embeds/donate.embed';

export const donateCommand = {
  data: new SlashCommandBuilder().setName('donate').setDescription('Support the bot development and server costs'),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 0 * 1000,
      rateLimitKey: 'donate',
      requireGuild: false,
      ephemeral: true,
      logLabel: 'Donate command failed to execute',
      fallbackMessage: '❌ An error occurred while displaying the donation information.',
      execute: async () => {
        const embed = buildDonateEmbed();

        await interaction.editReply({
          embeds: [embed],
        });
      },
    });
  },
};
