import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';

export function buildChannelDetailEmbed(channelConfig: ChannelConfigEntity, channelName: string, tagDisplayName?: string) {
  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Channel Configuration`)
    .setDescription(`**Channel:** <#${channelConfig.channelId}>`)
    .addFields(
      {
        name: 'Current Settings',
        value: [
          `**Notify on Close:** ${channelConfig.notifyOnClose ? '✅ Enabled' : '❌ Disabled'}`,
          `**Threshold:** ${channelConfig.threshold > 0 ? `±${channelConfig.threshold}%` : 'Not set'}`,
          `**Image Attachments:** ${channelConfig.image ? '✅ Enabled' : '❌ Disabled'}`,
          `**Pin Messages:** ${channelConfig.pin ? '✅ Enabled' : '❌ Disabled'}`,
          `**Tag on Notify:** ${tagDisplayName || 'None set'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔧 Action Buttons',
        value: [
          '• **🔔 ON/OFF** – toggle notifications on position close',
          '• **📷 ON/OFF** – toggle image attachments on notify',
          '• **📌 ON/OFF** – toggle pinning the notification message',
          '• **📊 Threshold** – open modal to set ±% threshold',
          '• **🏷️ Tag** – select or clear a user/role mention',
          '• **⬅️ Back** – return to the channels list',
        ].join('\n'),
        inline: false,
      }
    )
    .setColor(0x5865F2);

  return embed;
}

export function buildChannelDetailComponents(channelConfig: ChannelConfigEntity) {
  const components: ActionRowBuilder<any>[] = [];

  const toggleRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`channel:toggle:notifyOnClose:${channelConfig.channelId}`)
        .setLabel(channelConfig.notifyOnClose ? 'Disable Notify' : 'Enable Notify')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId(`channel:toggle:image:${channelConfig.channelId}`)
        .setLabel(channelConfig.image ? 'Disable Images' : 'Enable Images')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📷'),
      new ButtonBuilder()
        .setCustomId(`channel:toggle:pin:${channelConfig.channelId}`)
        .setLabel(channelConfig.pin ? 'Disable Pin' : 'Enable Pin')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📌'),
      new ButtonBuilder()
        .setCustomId(`channel:threshold:${channelConfig.channelId}`)
        .setLabel('Set Threshold')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊')
    );

  const tagRow = new ActionRowBuilder<ButtonBuilder>();

  tagRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`channel:tag:select_user:${channelConfig.channelId}`)
      .setLabel('Tag User')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId(`channel:tag:select_role:${channelConfig.channelId}`)
      .setLabel('Tag Role')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥')
  );

  if (channelConfig.tagType !== 'NONE') {
    tagRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`channel:tag:clear:${channelConfig.channelId}`)
        .setLabel('Clear Tag')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚫')
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('channels:back')
        .setLabel('Back to Channels')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );

  components.push(toggleRow, tagRow, navRow);
  return components;
}
