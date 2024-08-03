import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function buildWalletModal(currentWallet: string | null, currentStopLoss: number | null) {
  const modal = new ModalBuilder()
    .setCustomId('server:position-size-defaults:submit')
    .setTitle('Position Size Defaults');

  const walletInput = new TextInputBuilder()
    .setCustomId('position_size_wallet')
    .setLabel('Default Solana Wallet (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter a valid Solana wallet address or leave blank')
    .setRequired(false);

  if (currentWallet) {
    walletInput.setValue(currentWallet);
  }

  const slInput = new TextInputBuilder()
    .setCustomId('position_size_sl')
    .setLabel('Default Stop Loss % (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 12 for 12%')
    .setRequired(false);

  if (currentStopLoss !== null && currentStopLoss !== undefined) {
    slInput.setValue(String(currentStopLoss));
  }

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(walletInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(slInput);
  modal.addComponents(row1, row2);

  return modal;
}
