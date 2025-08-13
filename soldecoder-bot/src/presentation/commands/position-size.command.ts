import {  SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { GetGuildSettingsUseCase } from '@application/use-cases/get-guild-settings.use-case';
import { WalletInfoService } from '@infrastructure/services/wallet-info.service';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import { buildPositionSizeEmbed } from '@presentation/ui/embeds/position-size.embed';
import { MissingConfigurationError, InvalidCommandUsageError } from '@presentation/commands/command-errors';
import { runCommand } from '@presentation/commands/command-runner';

function computeRecommendedSize(totalNetWorth: number, positionsCount: number, percent: number): number {
  const base = (totalNetWorth - 1) / positionsCount;
  const penalty = (totalNetWorth * percent) / (100 * positionsCount * positionsCount);
  return Math.max(0, base - penalty);
}

export const positionSizeCommand = {
  data: new SlashCommandBuilder()
    .setName('position-size')
    .setDescription('Get recommended size per position based on wallet net worth')
    .addStringOption(o =>
      o.setName('wallet')
        .setDescription('Optional Solana wallet address to override default')
        .setRequired(false)
    )
    .addNumberOption(o =>
      o.setName('stoploss')
        .setDescription('Optional stop loss percent (overrides default)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addNumberOption(o =>
      o.setName('current_size')
        .setDescription('Optional current position size to compute Δ% (0.1 - 1000)')
        .setMinValue(0.1)
        .setMaxValue(1000)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 15 * 60_000,
      rateLimitKey: 'position-size',
      requireGuild: true,
      ephemeral: true,
      logLabel: 'Error executing position-size command',
      fallbackMessage: '❌ Failed to compute position sizes. Please try again later.',
      execute: async () => {
      const walletInput = interaction.options.getString('wallet', false) || undefined;
      const stoplossInput = interaction.options.getNumber('stoploss', false) ?? undefined;
      const currentSizeInput = interaction.options.getNumber('current_size', false) ?? undefined;

      const guildRepo = new DynamoGuildSettingsRepository();
      const getGuildUC = new GetGuildSettingsUseCase(guildRepo);
      const settings = await getGuildUC.execute(interaction.guildId!);

      if (!settings) {
        throw new MissingConfigurationError();
      }

      const defaultWallet = settings.positionSizeDefaults.walletAddress ?? null;
      const defaultSl = settings.positionSizeDefaults.stopLossPercent ?? null;

      const walletToUse = (walletInput ?? '').trim() || defaultWallet || '';

      const stoploss = stoplossInput ?? (defaultSl !== null ? defaultSl : Number.NaN);

      if (!walletToUse) {
        throw new MissingConfigurationError('ℹ️ No default wallet set. Provide `wallet` option or set defaults via `/server-settings → Position Size Defaults`.');
      }

      if (!Number.isFinite(stoploss)) {
        throw new MissingConfigurationError('ℹ️ No default stop loss set. Provide `stoploss` option or set defaults via `/server-settings → Position Size Defaults`.');
      }

      let walletVO: WalletAddress;
      try {
        walletVO = WalletAddress.create(walletToUse);
      } catch {
        throw new InvalidCommandUsageError('❌ Invalid wallet address.');
      }
      const shortWallet = walletVO.getShortAddress();

      const walletInfo = WalletInfoService.getInstance();
      const totalNetWorth = await walletInfo.getTotalNetWorth(walletToUse);

      const counts = [1, 2, 3, 4, 5];
      const items = counts.map((c) => {
        const size = computeRecommendedSize(totalNetWorth, c, stoploss);
        const slAmount = (size * stoploss) / 100;
        const delta = currentSizeInput ? ((size - currentSizeInput) / currentSizeInput) * 100 : null;
        return { positions: c, size, sl: slAmount, delta };
      });

      const embed = buildPositionSizeEmbed({
        shortWallet,
        netWorth: totalNetWorth,
        stoploss,
        currentSize: currentSizeInput ?? null,
        items,
      });

        await interaction.editReply({ embeds: [embed] });
      },
    });
  }
};
