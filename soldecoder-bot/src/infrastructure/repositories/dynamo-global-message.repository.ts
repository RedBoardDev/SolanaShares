import { CacheService } from '@infrastructure/services/cache.service';
import { logger } from '@helpers/logger';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';

export type { GlobalPositionMessage };

/**
 * Repository for global position messages.
 * All operations are performed exclusively via the CacheService.
 */
export class DynamoGlobalMessageRepository {
  private readonly cacheService: CacheService;

  constructor() {
    this.cacheService = CacheService.getInstance();
  }

  async getGlobalMessageId(guildId: string): Promise<string | null> {
    logger.debug('[REPO] Getting global message ID', { guildId });
    const message = await this.cacheService.getGlobalMessage(guildId);
    return message ? message.messageId : null;
  }

  async getGlobalMessage(guildId: string): Promise<GlobalPositionMessage | null> {
    logger.debug('[REPO] Getting global message', { guildId });
    return await this.cacheService.getGlobalMessage(guildId);
  }

  async saveGlobalMessage(guildId: string, messageId: string): Promise<void> {
    logger.debug('[REPO] Saving global message', { guildId, messageId });
    return await this.cacheService.saveGlobalMessage(guildId, messageId);
  }

  async deleteGlobalMessage(guildId: string): Promise<void> {
    logger.debug('[REPO] Deleting global message', { guildId });
    return await this.cacheService.deleteGlobalMessage(guildId);
  }
}
