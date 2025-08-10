export interface TimezoneOption {
  name: string;
  value: string;
}

export const COMMON_TIMEZONES: readonly TimezoneOption[] = [
  // Europe
  { name: 'Europe/London (United Kingdom)', value: 'Europe/London' },
  { name: 'Europe/Paris (France)', value: 'Europe/Paris' },
  { name: 'Europe/Berlin (Deutschland)', value: 'Europe/Berlin' },
  { name: 'Europe/Moscow (Russia)', value: 'Europe/Moscow' },
  { name: 'Europe/Rome (Italia)', value: 'Europe/Rome' },
  { name: 'Europe/Madrid (España)', value: 'Europe/Madrid' },
  { name: 'Europe/Amsterdam (Nederland)', value: 'Europe/Amsterdam' },
  { name: 'Europe/Stockholm (Sverige)', value: 'Europe/Stockholm' },

  // Americas
  { name: 'America/New_York (USA EST)', value: 'America/New_York' },
  { name: 'America/Chicago (USA CST)', value: 'America/Chicago' },
  { name: 'America/Denver (USA MST)', value: 'America/Denver' },
  { name: 'America/Los_Angeles (USA PST)', value: 'America/Los_Angeles' },
  { name: 'America/Toronto (Canada East)', value: 'America/Toronto' },
  { name: 'America/Sao_Paulo (Brasil)', value: 'America/Sao_Paulo' },
  { name: 'America/Mexico_City (México)', value: 'America/Mexico_City' },

  // Asia
  { name: 'Asia/Dubai (UAE)', value: 'Asia/Dubai' },
  { name: 'Europe/Helsinki (Suomi)', value: 'Europe/Helsinki' },
  { name: 'Asia/Shanghai (China)', value: 'Asia/Shanghai' },
  { name: 'Asia/Tokyo (Japan)', value: 'Asia/Tokyo' },
  { name: 'Asia/Singapore (Singapore)', value: 'Asia/Singapore' },
  { name: 'Asia/Seoul (South Korea)', value: 'Asia/Seoul' },

  // Oceania
  { name: 'Australia/Sydney (Australia East)', value: 'Australia/Sydney' },
  { name: 'Pacific/Auckland (New Zealand)', value: 'Pacific/Auckland' },

  // UTC
  { name: 'UTC (Universal Time)', value: 'Etc/UTC' },
] as const;

export type Timezone = (typeof COMMON_TIMEZONES)[number]['value'];

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class TimezoneHelper {
  static all(): TimezoneOption[] {
    return [...COMMON_TIMEZONES];
  }

  static default(): Timezone {
    return 'Europe/London';
  }

  static isValid(tz: string): tz is Timezone {
    return COMMON_TIMEZONES.some(option => option.value === tz);
  }

  static getTimezoneOption(value: string): TimezoneOption | undefined {
    return COMMON_TIMEZONES.find(option => option.value === value);
  }
}
