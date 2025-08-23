import { ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, ChannelType } from 'discord.js';

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
    availableChannels = [],
  } = options;

  if (useNativeSelect) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(minValues)
        .setMaxValues(maxValues),
    );
  }
  if (availableChannels.length === 0) {
    throw new Error('availableChannels must be provided when useNativeSelect is false');
  }

  // Validate and sanitize channel options
  const validOptions = availableChannels
    .slice(0, 25)
    .filter((channel) => {
      // Ensure channel has required properties and they are valid
      return (
        channel &&
        typeof channel.id === 'string' &&
        channel.id.length > 0 &&
        typeof channel.name === 'string' &&
        channel.name.length > 0
      );
    })
    .map((channel) => ({
      label: `# ${channel.name}`.slice(0, 100), // Discord limit is 100 chars
      description: `Select ${channel.name}`.slice(0, 100), // Discord limit is 100 chars
      value: channel.id,
    }));

  // Ensure we have at least one valid option
  if (validOptions.length === 0) {
    throw new Error('No valid channel options available for select menu');
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(minValues)
      .setMaxValues(maxValues)
      .addOptions(validOptions),
  );
}

export function buildServerChannelSelectComponent() {
  return buildChannelSelectComponent({
    customId: 'server:channel:set',
    placeholder: 'Select a channel for summaries and position display',
    useNativeSelect: true,
  });
}

export function buildChannelAddSelectComponent() {
  return buildChannelSelectComponent({
    customId: 'channels:add',
    placeholder: 'Select a channel to add (search available)',
    useNativeSelect: true,
  });
}

export function buildChannelRemoveSelectComponent(
  configuredChannels: Array<{ channelId: string }>,
  allGuildChannels: Array<{ id: string; name: string }>,
) {
  // Validate input data
  if (!configuredChannels || configuredChannels.length === 0) {
    throw new Error('No channels available to remove');
  }

  if (!allGuildChannels || allGuildChannels.length === 0) {
    throw new Error('No guild channels data available');
  }

  const channelsForSelect = configuredChannels
    .map((config) => {
      // Validate channelId exists and is a string
      if (!config.channelId || typeof config.channelId !== 'string') {
        return null;
      }

      const guildChannel = allGuildChannels.find((gc) => gc.id === config.channelId);
      return {
        id: config.channelId,
        name: guildChannel?.name || 'Unknown Channel',
      };
    })
    .filter((channel): channel is { id: string; name: string } => channel !== null);

  // Ensure we have valid channels to show
  if (channelsForSelect.length === 0) {
    throw new Error('No valid channels available to remove');
  }

  const component = buildChannelSelectComponent({
    customId: 'channels:remove',
    placeholder: 'Select a channel to remove',
    useNativeSelect: false,
    availableChannels: channelsForSelect,
  });

  const selectMenu = component.components[0] as any;
  if (selectMenu?.data?.options) {
    selectMenu.data.options = selectMenu.data.options.map((option: any) => ({
      ...option,
      description: 'Remove this channel from followed channels',
      emoji: { name: '🗑️' },
    }));
  }

  return component;
}
