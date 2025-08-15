import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import { config } from '@infrastructure/config/env';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import { ParticipantEntity } from '@domain/entities/participant.entity';

export const linkWalletCommand = {
  data: new SlashCommandBuilder()
    .setName('link-wallet')
    .setDescription('Link your wallet to your Discord account.')
    .addStringOption((option) =>
      option
        .setName('wallet')
        .setDescription('The Solana wallet address you want to link to your Discord account.')
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const walletInput = interaction.options.getString('wallet');
      if (!walletInput) {
        throw new Error('Wallet address is required');
      }

      const discordUserId = interaction.user.id;
      const participantRepo = new DynamoParticipantRepository();

      const wallet = await validateWalletAddress(walletInput);
      if (!wallet) {
        await sendErrorResponse(interaction, '❌ Invalid wallet address format. Please provide a valid Solana wallet address.');
        return;
      }

      const walletAddress = wallet.toString();

      const validationResult = await performValidations(discordUserId, walletAddress, participantRepo);
      if (!validationResult.isValid) {
        await sendErrorResponse(interaction, validationResult.errorMessage || '❌ Validation failed. Please try again.');
        return;
      }

       await createAndSaveParticipant(discordUserId, walletAddress, participantRepo);

    } catch (error) {
      logger.error('Error executing link wallet command', error as Error);
      await sendErrorResponse(interaction, '❌ An error occurred while processing the link wallet command. Please try again later.');
    }
  },
};

async function validateWalletAddress(walletInput: string): Promise<WalletAddress | null> {
  try {
    return WalletAddress.create(walletInput);
  } catch (error) {
    logger.debug('Invalid wallet address provided', { walletInput });
    return null;
  }
}

async function isMonitoredWallet(walletAddress: string): Promise<boolean> {
  return walletAddress === config.solana.phase.wallet;
}

async function performValidations(
  discordUserId: string,
  walletAddress: string,
  participantRepo: DynamoParticipantRepository
): Promise<{ isValid: boolean; errorMessage?: string }> {
  if (await isMonitoredWallet(walletAddress)) {
    return {
      isValid: false,
      errorMessage: '❌ You cannot link the monitored wallet address. Please use your personal wallet address.'
    };
  }

  const existingParticipant = await participantRepo.findByDiscordUser(discordUserId);
  if (existingParticipant) {
    return {
      isValid: false,
      errorMessage: `❌ You already have a wallet linked: \`${existingParticipant.walletAddress}\`\n\nIf you want to change your wallet, please contact an administrator.`
    };
  }

  const existingWalletUser = await participantRepo.findByWalletAddress(walletAddress);
  if (existingWalletUser) {
    return {
      isValid: false,
      errorMessage: '❌ This wallet address is already linked to another Discord account.'
    };
  }

  return { isValid: true };
}

async function createAndSaveParticipant(
  discordUserId: string,
  walletAddress: string,
  participantRepo: DynamoParticipantRepository
): Promise<void> {
  const participant = ParticipantEntity.create(discordUserId, walletAddress, 0);
  await participantRepo.save(participant);
  logger.info('New participant created', { discordUserId, walletAddress });
}

async function sendErrorResponse(interaction: ChatInputCommandInteraction, message: string): Promise<void> {
  await interaction.editReply({ content: message });
}

async function sendSuccessResponse(interaction: ChatInputCommandInteraction, walletAddress: string, timeUntilSync: string): Promise<void> {
  await interaction.editReply({
    content: `✅ **Wallet linked successfully!**\n\n🔗 **Wallet:** \`${walletAddress}\`\n\n⏱️ **Next sync:** ${timeUntilSync}\n📊 Your investment data will be calculated from the blockchain.\n💡 Use \`/wallet\` to view your balance after the sync completes.`,
  });
}
