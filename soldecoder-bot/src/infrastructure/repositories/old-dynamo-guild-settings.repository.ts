// import type { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
// import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
// import { CacheService } from '@infrastructure/services/cache.service';
// import { logger } from '@helpers/logger';
// import type { ICacheService } from '@domain/interfaces/cache.service.interface';

// /**
//  * Repository for guild settings.
//  * All operations are performed exclusively via the CacheService.
//  */
// export class DynamoGuildSettingsRepository implements GuildSettingsRepository {
//   private readonly cacheService: ICacheService;

//   constructor() {
//     this.cacheService = CacheService.getInstance();
//   }

//   async getByGuildId(guildId: string): Promise<GuildSettingsEntity | null> {
//     logger.debug('[REPO] Getting guild settings by guildId', { guildId });
//     return await this.cacheService.getGuildSettings(guildId);
//   }

//   async save(guildSettings: GuildSettingsEntity): Promise<void> {
//     logger.debug('[REPO] Saving guild settings', { guildId: guildSettings.guildId });
//     return await this.cacheService.saveGuildSettings(guildSettings);
//   }

//   async delete(guildId: string): Promise<void> {
//     logger.debug('[REPO] Deleting guild settings', { guildId });
//     return await this.cacheService.deleteGuildSettings(guildId);
//   }

//   async exists(guildId: string): Promise<boolean> {
//     const settings = await this.cacheService.getGuildSettings(guildId);
//     return settings !== null;
//   }

//   async getAllGuilds(): Promise<GuildSettingsEntity[]> {
//     logger.debug('[REPO] Getting all guild settings');
//     return await this.cacheService.getAllGuildSettings();
//   }
// }
