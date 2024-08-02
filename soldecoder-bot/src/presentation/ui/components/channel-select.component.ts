import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} from 'discord.js';

export interface ChannelSelectOptions {
  customId: string;
  placeholder: string;
  minValues?: number;
  maxValues?: number;
  useNativeSelect?: boolean;
  availableChannels?: Array<{ id: string; name: string }>;
}

export function buildChannelSelectComponent(options: ChannelSelectOptions) {
  const {
    customId,
    placeholder,
    minValues = 1,
    maxValues = 1,
    useNativeSelect = true,
    availableChannels = []
  } = options;

  if (useNativeSelect) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder(placeholder)
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(minValues)
          .setMaxValues(maxValues)
      );
  } else {
    if (availableChannels.length === 0) {
      throw new Error('availableChannels must be provided when useNativeSelect is false');
    }

    return new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder(placeholder)
          .setMinValues(minValues)
          .setMaxValues(maxValues)
          .addOptions(
            availableChannels.slice(0, 25).map(channel => ({
              label: `# ${channel.name}`,
              description: `Select ${channel.name}`,
              value: channel.id,
            }))
          )
      );
  }
}

export function buildServerChannelSelectComponent() {
  return buildChannelSelectComponent({
    customId: 'server:channel:set',
    placeholder: 'Select a channel for summaries and position display',
    useNativeSelect: true
  });
}

export function buildChannelAddSelectComponent() {
  return buildChannelSelectComponent({
    customId: 'channels:add',
    placeholder: 'Select a channel to add (search available)',
    useNativeSelect: true
  });
}

export function buildChannelRemoveSelectComponent(
  configuredChannels: Array<{ channelId: string }>,
  allGuildChannels: Array<{ id: string; name: string }>
) {
  const channelsForSelect = configuredChannels.map(config => {
    const guildChannel = allGuildChannels.find(gc => gc.id === config.channelId);
    return {
      id: config.channelId,
      name: guildChannel?.name || 'Unknown'
    };
  });

  const component = buildChannelSelectComponent({
    customId: 'channels:remove',
    placeholder: 'Select a channel to remove',
    useNativeSelect: false,
    availableChannels: channelsForSelect
  });

  const selectMenu = component.components[0] as any;
  if (selectMenu && selectMenu.data && selectMenu.data.options) {
    selectMenu.data.options = selectMenu.data.options.map((option: any) => ({
      ...option,
      description: 'Remove this channel from followed channels',
      emoji: { name: '🗑️' }
    }));
  }

  return component;
}
