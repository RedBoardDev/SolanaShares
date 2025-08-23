// import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
// import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
// import { CacheService } from '@infrastructure/services/cache.service';
// import { logger } from '@helpers/logger';
// import type { ICacheService } from '@domain/interfaces/cache.service.interface';

// /**
//  * Repository for channel configuration entities.
//  * All operations are performed exclusively via the CacheService for optimal performance and consistency.
//  */
// export class DynamoChannelConfigRepository implements ChannelConfigRepository {
//   private readonly cacheService: ICacheService;

//   constructor() {
//     this.cacheService = CacheService.getInstance();
//   }

//   async getByChannelId(channelId: string): Promise<ChannelConfigEntity | null> {
//     logger.debug('[REPO] Getting channel config by channelId', { channelId });
//     return await this.cacheService.getChannelConfig(channelId);
//   }

//   async getByGuildId(guildId: string): Promise<ChannelConfigEntity[]> {
//     logger.debug('[REPO] Getting channel configs by guildId', { guildId });
//     return await this.cacheService.getGuildChannels(guildId);
//   }

//   async save(channelConfig: ChannelConfigEntity): Promise<void> {
//     logger.debug('[REPO] Saving channel config', {
//       channelId: channelConfig.channelId,
//       guildId: channelConfig.guildId,
//     });
//     return await this.cacheService.saveChannelConfig(channelConfig);
//   }

//   async delete(channelId: string): Promise<void> {
//     logger.debug('[REPO] Deleting channel config', { channelId });
//     return await this.cacheService.deleteChannelConfig(channelId);
//   }

//   async exists(channelId: string): Promise<boolean> {
//     const config = await this.cacheService.getChannelConfig(channelId);
//     return config !== null;
//   }

//   async getAll(): Promise<ChannelConfigEntity[]> {
//     logger.debug('[REPO] Getting all channel configs');
//     return await this.cacheService.getAllChannelConfigs();
//   }
// }
