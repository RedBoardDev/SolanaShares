import { ActionRowBuilder, StringSelectMenuBuilder, } from 'discord.js';
import { COMMON_TIMEZONES, type Timezone, TimezoneHelper } from '@domain/value-objects/timezone';
import { buildServerChannelSelectComponent } from './channel-select.component';

export function buildTimezoneSelectComponent() {
  const timezoneOptions = COMMON_TIMEZONES.map((tzOption) => {
    const { name, value } = tzOption;
    let region = 'Other';
    let emoji = '🌍';

    // Determine region and emoji based on timezone value
    if (value.startsWith('Europe/')) {
      region = 'Europe';
      emoji = '🇪🇺';
    } else if (value.startsWith('America/')) {
      region = 'Americas';
      emoji = '🇺🇸';
    } else if (value.startsWith('Asia/')) {
      region = 'Asia';
      emoji = '🇯🇵';
    } else if (value.startsWith('Australia/') || value.startsWith('Pacific/')) {
      region = 'Oceania';
      emoji = '🇦🇺';
    } else if (value.startsWith('Africa/')) {
      region = 'Africa';
      emoji = '🌍';
    } else if (value === 'Etc/UTC') {
      region = 'UTC';
      emoji = '🌐';
    }

    return {
      label: name,
      description: `${emoji} ${region} • ${value}`,
      value: value,
    };
  });

  const timezoneSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('server:timezone:set')
        .setPlaceholder('🌍 Select your timezone...')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(timezoneOptions.slice(0, 25)) // Discord limit
    );

  return timezoneSelectRow;
}

export function buildChannelSelectComponent() {
  return buildServerChannelSelectComponent();
}

export function getTimezoneDisplayName(timezone: Timezone): string {
  // Use the TimezoneHelper to get the proper display name
  const timezoneOption = TimezoneHelper.getTimezoneOption(timezone);

  if (timezoneOption) {
    return timezoneOption.name;
  }

  // Fallback to the timezone value if not found (shouldn't happen)
  return timezone;
}
