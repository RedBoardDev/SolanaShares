import { parsePositionStatusMessage } from '@application/parsers/position-status.parser';
import { logger } from '@helpers/logger';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { InvalidCommandUsageError } from '@presentation/commands/command-errors';
import { runCommand } from '@presentation/commands/command-runner';
import { buildGlobalPositionEmbed } from '@presentation/ui/embeds/global-position.embed';
import { buildDonateButton } from '@presentation/ui/components/donate-button.component';
import type { PositionStatus } from '@schemas/position-status.schema';
import { type ChatInputCommandInteraction, SlashCommandBuilder, type TextChannel } from 'discord.js';

export const globalPositionsCommand = {
  data: new SlashCommandBuilder()
    .setName('global-positions')
    .setDescription('Show global position display (ephemeral)')
    .addBooleanOption((o) =>
      o
        .setName('percent_only')
        .setDescription('If true, hide SOL amounts and show percentages only')
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const percentOnly = interaction.options.getBoolean('percent_only', false) ?? false;
    await runCommand({
      interaction,
      rateLimitMs: 1 * 60_000,
      rateLimitKey: 'global-positions',
      requireGuild: true,
      ephemeral: true,
      logLabel: 'Error in global-positions command',
      fallbackMessage: '❌ Failed to load global positions.',
      execute: async () => {
        const guildId = interaction.guildId;
        if (!guildId) {
          throw new Error('Guild ID not found');
        }

        const channelRepo = new DynamoChannelConfigRepository();

        const channels = await channelRepo.getByGuildId(guildId);
        if (channels.length === 0) {
          throw new InvalidCommandUsageError('ℹ️ No configured channels to read positions from.');
        }

        const positionsByWallet = new Map<string, PositionStatus[]>();

        for (const ch of channels) {
          try {
            const guild = interaction.guild;
            if (!guild) continue;

            const chan = guild.channels.cache.get(ch.channelId);
            if (!chan || chan.type !== 0) continue;

            const textChannel = chan as TextChannel;
            const messages = await textChannel.messages.fetch({ limit: 1 });
            const latest = messages.first();
            if (!latest) continue;

            const parsed = parsePositionStatusMessage(latest.content);
            if (!parsed) continue;

            const key = parsed.walletName;
            if (!positionsByWallet.has(key)) positionsByWallet.set(key, []);
            positionsByWallet.get(key)?.push(parsed);
          } catch (err) {
            logger.warn('Failed to fetch or parse channel message', {
              channelId: ch.channelId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const embed = buildGlobalPositionEmbed(positionsByWallet, {
          percentOnly,
          footerText: 'SolanaShares bot',
        });

        const components = [buildDonateButton()];

        await interaction.editReply({
          embeds: [embed],
          components,
        });
      },
    });
  },
};
