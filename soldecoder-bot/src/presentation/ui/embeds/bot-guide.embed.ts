import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildBotGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎉 SOL Decoder Bot - Complete Guide')
    .setDescription('**Everything you need to know to use the bot effectively**')
    .addFields(
      {
        name: '✅ Basic Configuration',
        value: [
          '• **Global Channel**: Where TP/SL forwards and position summaries appear',
          '• **Main Wallet**: Your primary Solana address for tracking',
          '• **Timezone**: For time-based reports and notifications',
          '• **Stop Loss**: Default percentage for position sizing commands'
        ].join('\n'),
        inline: false
      },
      {
        name: '🔧 Server Settings (`/server-settings`)',
        value: [
          '• **Position Display**: Toggle summary messages in global channel',
          '• **Forward TP/SL**: Send take-profit/stop-loss alerts to global channel',
          '• **Auto-delete Warnings**: Automatically remove bot warning messages',
          '• **Position Size Defaults**: Update wallet address and stop loss % (useful for `/position-size` command)',
          '• **Global Channel**: Change the main notification channel'
        ].join('\n'),
        inline: false
      },
      {
        name: '📊 Channel Configuration (`/followed-channels`)',
        value: [
          '• **Add/Remove Channels**: Configure which channels the bot monitors',
          '• **Notify on Close**: Get alerts when positions close (recommended)',
          '• **Image Attachments**: Include position charts from LPAgent data',
          '• **Pin Messages**: Automatically pin important notifications',
          '• **Threshold**: Set ±% change triggers for alerts',
          '• **Tags**: Mention specific users/roles on notifications',
          '',
          '💡 **Tip**: Set the SolDecoder farmer notification interval to 1 minute for near real-time position tracking'
        ].join('\n'),
        inline: false
      },
      {
        name: '🚀 Key Features & Commands',
        value: [
          '• `/position-size` - Calculate optimal position sizes based on your wallet',
          '• `/global-positions` - View aggregated positions across all followed channels',
          '• `/nft-price` - Check SOL Decoder NFT collection floor prices',
          '• `/help` - Display this comprehensive guide anytime',
          '',
          '**Data Source**: All position stats and images come from **LPAgent API** (except for Position Display, which fetches directly from terminals to stay as close as possible to the farmer bot data)',
          '**Real-time**: Bot monitors your channels and processes position messages automatically'
        ].join('\n'),
        inline: false
      },
      {
        name: '⚡ Pro Tips for Users',
        value: [
          '• Start by adding 1-2 channels with **Notify on Close** enabled',
          '• Enable **Image Attachments** to see position charts and stats',
          '• Use **Position Display** to get summaries in your global channel',
          '• Configure **Tags** to notify your team on important position changes',
          '• The bot automatically parses position data from LPAgent messages',
          '• Use `/start` command to reconfigure your server settings anytime'
        ].join('\n'),
        inline: false
      }
    )
    .setColor(0x00D966)
    .setFooter({ text: 'Need help? Use the buttons below to access settings!' });
}

export function buildBotGuideComponents(): ActionRowBuilder<any>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('guide:view_settings')
          .setLabel('View Server Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('guide:setup_channels')
          .setLabel('Setup Channels')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      )
  ];
}
