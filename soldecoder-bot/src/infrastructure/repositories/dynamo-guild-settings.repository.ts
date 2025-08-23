import type { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { CachedRepositoryBase } from './base/cached-repository.base';
import { logger } from '@helpers/logger';

/**
 * Simplified guild settings repository using the cached base class.
 * Much cleaner and no repetitive cache/database logic!
 */
export class DynamoGuildSettingsRepository extends CachedRepositoryBase implements GuildSettingsRepository {
  private readonly CACHE_PREFIX = 'guild_settings';

  async getByGuildId(guildId: string): Promise<GuildSettingsEntity | null> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildId}`;

    return this.cachedGet(
      cacheKey,
      () => this.databaseService.getGuildSettings(guildId),
      { guildId, operation: 'getByGuildId' }
    );
  }

  async save(guildSettings: GuildSettingsEntity): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildSettings.guildId}`;

    await this.cachedSave(
      cacheKey,
      guildSettings,
      (settings) => this.databaseService.saveGuildSettings(settings),
      { guildId: guildSettings.guildId, operation: 'save' }
    );
  }

  async delete(guildId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildId}`;

    await this.cachedDelete(
      cacheKey,
      () => this.databaseService.deleteGuildSettings(guildId),
      { guildId, operation: 'delete' }
    );
  }

  async exists(guildId: string): Promise<boolean> {
    const settings = await this.getByGuildId(guildId);
    return settings !== null;
  }

  async getAllGuilds(): Promise<GuildSettingsEntity[]> {
    logger.debug('[SIMPLE_REPO] Getting all guild settings');

    // Load all from database
    const allSettings = await this.databaseService.getAllGuildSettings();

    // Cache everything at once
    this.cacheMultiple(allSettings, settings => `${this.CACHE_PREFIX}:${settings.guildId}`);

    logger.debug('[SIMPLE_REPO] All guild settings loaded and cached', { total: allSettings.length });

    return allSettings;
  }
}
