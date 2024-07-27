import { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { logger } from '@helpers/logger';

export class InitGuildSettingsUseCase {
  constructor(private readonly guildSettingsRepository: GuildSettingsRepository) {}

  async execute(guildId: string): Promise<GuildSettingsEntity> {
    logger.debug(`Initializing guild settings for guild ${guildId}`);

    try {
      const existingSettings = await this.guildSettingsRepository.getByGuildId(guildId);
      if (existingSettings) {
        logger.debug(`Guild settings already exist for guild ${guildId}`);
        return existingSettings;
      }

      const defaultSettings = GuildSettingsEntity.createDefault(guildId);

      await this.guildSettingsRepository.save(defaultSettings);

      return defaultSettings;
    } catch (error) {
      logger.error(`Failed to initialize guild settings for guild ${guildId}`, error as Error);
      throw error;
    }
  }
}
