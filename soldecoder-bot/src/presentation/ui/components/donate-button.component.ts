import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildDonateButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('donate:show_embed')
      .setLabel('Support the Bot')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💝'),
  );
}
