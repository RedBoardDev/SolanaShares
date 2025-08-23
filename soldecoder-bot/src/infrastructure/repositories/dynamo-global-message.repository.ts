import { CachedRepositoryBase } from './base/cached-repository.base';
import type { GlobalPositionMessage } from '@schemas/position-status.schema';

export type { GlobalPositionMessage };

/**
 * Simplified global message repository using the cached base class.
 * Clean and concise - no repetitive patterns!
 */
export class DynamoGlobalMessageRepository extends CachedRepositoryBase {
  private readonly CACHE_PREFIX = 'global_message';

  async getGlobalMessageId(guildId: string): Promise<string | null> {
    const message = await this.getGlobalMessage(guildId);
    return message ? message.messageId : null;
  }

  async getGlobalMessage(guildId: string): Promise<GlobalPositionMessage | null> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildId}`;

    return this.cachedGet(
      cacheKey,
      () => this.databaseService.getGlobalMessage(guildId),
      { guildId, operation: 'getGlobalMessage' }
    );
  }

  async saveGlobalMessage(guildId: string, messageId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildId}`;

    // Create the message object to cache
    const globalMessage: GlobalPositionMessage = {
      messageId,
      guildId,
      lastUpdated: Date.now(),
    };

    await this.cachedSave(
      cacheKey,
      globalMessage,
      () => this.databaseService.saveGlobalMessage(guildId, messageId),
      { guildId, messageId, operation: 'saveGlobalMessage' }
    );
  }

  async deleteGlobalMessage(guildId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}:${guildId}`;

    await this.cachedDelete(
      cacheKey,
      () => this.databaseService.deleteGlobalMessage(guildId),
      { guildId, operation: 'deleteGlobalMessage' }
    );
  }
}
