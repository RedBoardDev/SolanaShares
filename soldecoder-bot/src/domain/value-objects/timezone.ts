export const COMMON_TIMEZONES = [
  // Europe
  'Europe/London', // Royaume-Uni
  'Europe/Paris', // France
  'Europe/Berlin', // Allemagne
  'Europe/Moscow', // Russie
  'Europe/Helsinki', // Finlande
  'Europe/Rome', // Italie
  'Europe/Madrid', // Espagne

  // Amériques
  'America/New_York', // EST (USA)
  'America/Chicago', // CST (USA)
  'America/Denver', // MST (USA)
  'America/Los_Angeles', // PST (USA)
  'America/Toronto', // Canada Est
  'America/Sao_Paulo', // Brésil
  'America/Mexico_City', // Mexique

  // Asie
  'Asia/Dubai', // Émirats
  'Asia/Kolkata', // Inde
  'Asia/Shanghai', // Chine
  'Asia/Tokyo', // Japon
  'Asia/Singapore', // Singapour
  'Asia/Seoul', // Corée du Sud

  // Océanie
  'Australia/Sydney', // Australie Est
  'Pacific/Auckland', // Nouvelle-Zélande

  // Afrique
  'Africa/Cairo', // Égypte
  'Africa/Johannesburg', // Afrique du Sud

  // UTC
  'Etc/UTC',
] as const;

export type Timezone = (typeof COMMON_TIMEZONES)[number];

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class TimezoneHelper {
  static all(): Timezone[] {
    return [...COMMON_TIMEZONES];
  }

  static default(): Timezone {
    return 'Europe/London';
  }

  static isValid(tz: string): tz is Timezone {
    return (COMMON_TIMEZONES as readonly string[]).includes(tz);
  }
}
