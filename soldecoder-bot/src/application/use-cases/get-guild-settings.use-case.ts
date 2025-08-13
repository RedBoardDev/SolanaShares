import type { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { logger } from '@helpers/logger';

export class GetGuildSettingsUseCase {
  constructor(private readonly guildSettingsRepository: GuildSettingsRepository) {}

  async execute(guildId: string): Promise<GuildSettingsEntity | null> {
    logger.debug(`Getting guild settings for guild ${guildId}`);

    try {
      const settings = await this.guildSettingsRepository.getByGuildId(guildId);

      if (settings) {
        logger.debug(`Guild settings found for guild ${guildId}`);
      } else {
        logger.debug(`No guild settings found for guild ${guildId}`);
      }

      return settings;
    } catch (error) {
      logger.error(`Failed to get guild settings for guild ${guildId}`, error as Error);
      throw error;
    }
  }
}
