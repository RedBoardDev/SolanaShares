import { ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';
import { COMMON_TIMEZONES, Timezone } from '@domain/value-objects/timezone';
import { buildServerChannelSelectComponent } from './channel-select.component';

export function buildTimezoneSelectComponent() {
  const timezoneOptions = COMMON_TIMEZONES.map((tz) => {
    let region = 'Other';
    let label: string = tz as string;

    if (tz.startsWith('Europe/')) {
      region = '🇪🇺 Europe';
      label = tz.replace('Europe/', '');
    } else if (tz.startsWith('America/')) {
      region = '🇺🇸 Americas';
      label = tz.replace('America/', '');
    } else if (tz.startsWith('Asia/')) {
      region = '🇯🇵 Asia';
      label = tz.replace('Asia/', '');
    } else if (tz.startsWith('Australia/') || tz.startsWith('Pacific/')) {
      region = '🇦🇺 Oceania';
      label = tz.replace(/^(Australia|Pacific)\//, '');
    } else if (tz.startsWith('Africa/')) {
      region = '🌍 Africa';
      label = tz.replace('Africa/', '');
    } else if (tz === 'Etc/UTC') {
      region = '🌐 UTC';
      label = 'UTC';
    }

    return {
      label: `${label}`,
      description: `${region} • ${tz}`,
      value: tz as unknown as string,
    };
  });

  const timezoneSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('server:timezone:set')
        .setPlaceholder('Select your timezone')
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
  const timezoneMap: Record<string, string> = {
    'Europe/London': '🇬🇧 London (GMT)',
    'Europe/Paris': '🇫🇷 Paris (CET)',
    'Europe/Berlin': '🇩🇪 Berlin (CET)',
    'Europe/Moscow': '🇷🇺 Moscow (MSK)',
    'Europe/Helsinki': '🇫🇮 Helsinki (EET)',
    'Europe/Rome': '🇮🇹 Rome (CET)',
    'Europe/Madrid': '🇪🇸 Madrid (CET)',

    'America/New_York': '🇺🇸 New York (EST)',
    'America/Chicago': '🇺🇸 Chicago (CST)',
    'America/Denver': '🇺🇸 Denver (MST)',
    'America/Los_Angeles': '🇺🇸 Los Angeles (PST)',
    'America/Toronto': '🇨🇦 Toronto (EST)',
    'America/Sao_Paulo': '🇧🇷 São Paulo (BRT)',
    'America/Mexico_City': '🇲🇽 Mexico City (CST)',

    'Asia/Dubai': '🇦🇪 Dubai (GST)',
    'Asia/Kolkata': '🇮🇳 Kolkata (IST)',
    'Asia/Shanghai': '🇨🇳 Shanghai (CST)',
    'Asia/Tokyo': '🇯🇵 Tokyo (JST)',
    'Asia/Singapore': '🇸🇬 Singapore (SGT)',
    'Asia/Seoul': '🇰🇷 Seoul (KST)',

    'Australia/Sydney': '🇦🇺 Sydney (AEDT)',
    'Pacific/Auckland': '🇳🇿 Auckland (NZDT)',

    'Africa/Cairo': '🇪🇬 Cairo (EET)',
    'Africa/Johannesburg': '🇿🇦 Johannesburg (SAST)',

    'Etc/UTC': '🌐 UTC',
  };

  return timezoneMap[timezone] || timezone;
}
