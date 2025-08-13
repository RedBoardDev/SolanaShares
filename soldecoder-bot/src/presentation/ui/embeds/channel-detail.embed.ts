import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from 'discord.js';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';

export function buildChannelDetailEmbed(channelConfig: ChannelConfigEntity, channelName: string, tagDisplayName?: string) {
  const embed = new EmbedBuilder()
    .setTitle(`📊 Channel Configuration: #${channelName}`)
    .setDescription(`**Configuring monitoring for** <#${channelConfig.channelId}>`)
    .addFields(
      {
        name: '📋 Current Configuration',
        value: [
          `**Close Notifications:** ${channelConfig.notifyOnClose ? '✅ Enabled' : '❌ Disabled'}`,
          `**Alert Threshold:** ${channelConfig.threshold > 0 ? `±${channelConfig.threshold}%` : '❌ Not set'}`,
          `**Position Images:** ${channelConfig.image ? '✅ Enabled' : '❌ Disabled'}`,
          `**Auto-Pin Messages:** ${channelConfig.pin ? '✅ Enabled' : '❌ Disabled'}`,
          `**Mention on Alert:** ${tagDisplayName || '❌ None configured'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '💡 Feature Explanations',
        value: [
          '• **Close Notifications**: Alert when positions are closed in this channel',
          '• **Alert Threshold**: Trigger alerts when position changes by ±X%',
          '• **Position Images**: Include charts and stats from LPAgent data',
          '• **Auto-Pin Messages**: Pin important position notifications',
          '• **Mention on Alert**: Tag specific users/roles on notifications',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎯 Recommended Settings',
        value: [
          '• Enable **Close Notifications** for position tracking',
        '• **Alert Threshold**: Ignore closed positions unless change exceeds this %',
          '• Enable **Position Images** to see detailed charts',
          '• Use **Auto-Pin** on each closed positions',
        ].join('\n'),
        inline: false,
      }
    )
    .setColor(0x5865F2);

  return embed;
}

export function buildChannelDetailComponents(channelConfig: ChannelConfigEntity) {
  const components: ActionRowBuilder<any>[] = [];

  const notificationRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`channel:toggle:notifyOnClose:${channelConfig.channelId}`)
        .setLabel(channelConfig.notifyOnClose ? 'Disable Close Alerts' : 'Enable Close Alerts')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId(`channel:threshold:${channelConfig.channelId}`)
        .setLabel('Set Alert Threshold')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );

  const displayRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`channel:toggle:image:${channelConfig.channelId}`)
        .setLabel(channelConfig.image ? 'Disable Position Images' : 'Enable Position Images')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📷'),
      new ButtonBuilder()
        .setCustomId(`channel:toggle:pin:${channelConfig.channelId}`)
        .setLabel(channelConfig.pin ? 'Disable Auto-Pin' : 'Enable Auto-Pin')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📌')
    );

  const tagRow = new ActionRowBuilder<ButtonBuilder>();
  tagRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`channel:tag:select_user:${channelConfig.channelId}`)
      .setLabel('Mention User')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId(`channel:tag:select_role:${channelConfig.channelId}`)
      .setLabel('Mention Role')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👥')
  );

  if (channelConfig.tagType !== 'NONE') {
    tagRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`channel:tag:clear:${channelConfig.channelId}`)
        .setLabel('Clear Mentions')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚫')
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('channels:back')
        .setLabel('⬅️ Back to Channel List')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

  components.push(notificationRow, displayRow, tagRow, navRow);
  return components;
}
