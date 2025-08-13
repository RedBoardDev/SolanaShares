import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';

export interface GuildSettingsRepository {
  /** Retrieve the settings of a guild */
  getByGuildId(guildId: string): Promise<GuildSettingsEntity | null>;

  /** Create or update the settings of a guild */
  save(guildSettings: GuildSettingsEntity): Promise<void>;

  /** Delete the settings of a guild */
  delete(guildId: string): Promise<void>;

  /** Check if a guild exists */
  exists(guildId: string): Promise<boolean>;
}
