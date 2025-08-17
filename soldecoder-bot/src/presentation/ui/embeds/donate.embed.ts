import { EmbedBuilder } from 'discord.js';
import { config } from '@infrastructure/config/env';

export function buildDonateEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('💝 Support the Bot')
    .setDescription(
      '**Your support keeps this bot running and evolving**\n' +
        'Every donation helps cover server costs, API fees, and development time.\n' +
        '**Even $1-5 makes a real difference.**\n' +
        'Thank you for supporting the bot ! :pray:',
    )
    .addFields({
      name: 'Solana Address',
      value: `\`${config.donate.solanaAddress}\``,
      inline: false,
    })
    .setColor(0x00ae86)
    .setFooter({ text: 'Your generosity keeps the bot free for everyone' });
}
