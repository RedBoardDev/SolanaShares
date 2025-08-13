import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { CoinGeckoService } from '@infrastructure/services/coingecko.service';
import { buildNftPriceEmbed } from '@presentation/ui/embeds/nft-price.embed';
import { logger } from '@helpers/logger';
import { ExternalServiceError } from '@presentation/commands/command-errors';
import { runCommand } from '@presentation/commands/command-runner';

export const nftPriceCommand = {
  data: new SlashCommandBuilder()
    .setName('nft-price')
    .setDescription('Display floor price and market data for SOL Decoder NFT collection'),

  async execute(interaction: ChatInputCommandInteraction) {
    await runCommand({
      interaction,
      rateLimitMs: 1 * 60_000,
      rateLimitKey: 'nft-price',
      requireGuild: false,
      ephemeral: true,
      logLabel: '❌ Error executing NFT price command',
      fallbackMessage: '❌ Failed to load NFT price information.',
      execute: async () => {
      const coinGeckoService = CoinGeckoService.getInstance();

      const collectionId = 'sol-decoder';

      const nftData = await coinGeckoService.getNftData(collectionId);

      if (!nftData) {
        logger.warn('❌ NFT price command failed - no data available', {
          collectionId,
          userId: interaction.user.id
        });
        throw new ExternalServiceError('❌ Unable to load NFT data at the moment. Please try again later.');
      }

      const cacheInfo = coinGeckoService.getCacheInfo(collectionId);
      const lastUpdated = cacheInfo?.lastUpdated || new Date().toISOString();

      const embed = buildNftPriceEmbed(nftData, lastUpdated);
      await interaction.editReply({ embeds: [embed] });
    },
  });
  },
};
