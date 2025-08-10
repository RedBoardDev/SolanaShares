import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { buildChannelAddSelectComponent, buildChannelRemoveSelectComponent } from '../components/channel-select.component';

export function buildChannelListEmbed(channels: ChannelConfigEntity[]) {
  const embed = new EmbedBuilder()
    .setTitle('📊 Followed Channels Management')
    .setDescription(
      channels.length > 0
        ? `**${channels.length} channel${channels.length > 1 ? 's' : ''} configured** for position monitoring:`
        : '**No channels configured yet.** Add channels below to start monitoring positions!'
    )
    .setColor(0x5865F2);

  if (channels.length > 0) {
    channels.forEach(channel => {
      const configSummary = [];
      if (channel.notifyOnClose) configSummary.push('🔔 Alerts');
      if (channel.image) configSummary.push('📷 Images');
      if (channel.pin) configSummary.push('📌 Auto-pin');
      if (channel.tagType !== 'NONE') configSummary.push('🏷️ Mentions');
      if (channel.threshold > 0) configSummary.push(`📊 ${channel.threshold}% threshold`);

      embed.addFields({
        name: `<#${channel.channelId}>`,
        value: [
          `**Features**: ${configSummary.length > 0 ? configSummary.join(' • ') : 'Basic monitoring'}`,
          `**Close Alerts**: ${channel.notifyOnClose ? '✅ Enabled' : '❌ Disabled'}`,
          `**Alert Threshold**: ${channel.threshold > 0 ? `±${channel.threshold}%` : '❌ Not set'}`,
          `**Position Images**: ${channel.image ? '✅ Enabled' : '❌ Disabled'}`,
          `**Auto-Pin**: ${channel.pin ? '✅ Enabled' : '❌ Disabled'}`,
          `**Mentions**: ${
            channel.tagType !== 'NONE'
              ? `<@${channel.tagType === 'ROLE' ? '&' : ''}${channel.tagId}>`
              : '❌ None'
          }`
        ].join('\n'),
        inline: true,
      });
    });

    embed.addFields({
      name: '💡 Quick Tips',
      value: [
        '• **Close Alerts** let you pause notifications without deleting channel settings',
        '• **Alert Threshold**: Ignore closed positions unless change exceeds this %',
        '• **Position Images** show charts from LPAgent data',
        '• Use **Mentions** to notify on each closed position'
      ].join('\n'),
      inline: false,
    });
  } else {
    embed.addFields({
      name: '🚀 Getting Started',
      value: [
        '1. Click **Add Channel** to start monitoring a channel',
        '2. Configure **Close Alerts** for position notifications',
        '3. Set an **Alert Threshold**',
        '4. Enable **Position Images** to see LPAgent charts',
      ].join('\n'),
      inline: false,
    });
  }

  return embed;
}

export function buildChannelListComponents(channels: ChannelConfigEntity[], allGuildChannels: any[], showAddDropdown = false, showRemoveDropdown = false) {
  const components: ActionRowBuilder<any>[] = [];

  const managementRow = new ActionRowBuilder<ButtonBuilder>();

  const availableChannels = allGuildChannels.filter(
    guildChannel => !channels.some(config => config.channelId === guildChannel.id)
  );

  if (availableChannels.length > 0) {
    managementRow.addComponents(
      new ButtonBuilder()
        .setCustomId('channels:show_add')
        .setLabel('Add Channel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕')
    );
  }

  if (channels.length > 0) {
    managementRow.addComponents(
      new ButtonBuilder()
        .setCustomId('channels:show_remove')
        .setLabel('Remove Channel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖')
    );
  }

  if (managementRow.components.length > 0) {
    components.push(managementRow);
  }

  if (showAddDropdown && availableChannels.length > 0) {
    const addDropdownRow = buildChannelAddSelectComponent();
    components.push(addDropdownRow);
  }

  if (showRemoveDropdown && channels.length > 0) {
    const removeDropdownRow = buildChannelRemoveSelectComponent(channels, allGuildChannels);
    components.push(removeDropdownRow);
  }

  if (channels.length > 0) {
    for (let i = 0; i < channels.length; i += 5) {
      const channelRow = new ActionRowBuilder<ButtonBuilder>();
      const channelsSlice = channels.slice(i, i + 5);

      channelsSlice.forEach(channel => {
        const channelName = allGuildChannels.find(gc => gc.id === channel.channelId)?.name || 'Unknown';
        channelRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`channel:config:${channel.channelId}`)
            .setLabel(`# ${channelName}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
        );
      });

      components.push(channelRow);
    }
  }

  return components;
}
