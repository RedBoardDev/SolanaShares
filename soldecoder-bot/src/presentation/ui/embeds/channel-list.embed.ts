import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { buildChannelAddSelectComponent, buildChannelRemoveSelectComponent } from '../components/channel-select.component';

export function buildChannelListEmbed(channels: ChannelConfigEntity[]) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Followed Channels')
    .setDescription(
      channels.length > 0
        ? channels.length === 1
          ? 'Found 1 configured channel in this server:'
          : `Found ${channels.length} configured channels in this server:`
        : 'No channels are currently being followed in this server.'
    )
    .setColor(0x5865F2);

  if (channels.length > 0) {
    channels.forEach(channel => {
      embed.addFields({
        name: `<#${channel.channelId}>`,
        value: [
          `• Image: ${channel.image ? '✅' : '❌'}`,
          `• Notify on close: ${channel.notifyOnClose ? '✅' : '❌'}`,
          `• Pin: ${channel.pin ? '✅' : '❌'}`,
          `• Tag: ${
            channel.tagType !== 'NONE'
              ? `<@${channel.tagType === 'ROLE' ? '&' : ''}${channel.tagId}>`
              : 'None'
          }`,
          `• Threshold: ${channel.threshold}% (±)`
        ].join('\n'),
        inline: true,
      });
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
