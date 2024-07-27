import { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { GetGuildSettingsUseCase } from './get-guild-settings.use-case';
import { InitGuildSettingsUseCase } from './init-guild-settings.use-case';
import { logger } from '@helpers/logger';

export class EnsureGuildExistsUseCase {
  private readonly getGuildSettingsUC: GetGuildSettingsUseCase;
  private readonly initGuildSettingsUC: InitGuildSettingsUseCase;

  constructor(private readonly guildSettingsRepository: GuildSettingsRepository) {
    this.getGuildSettingsUC = new GetGuildSettingsUseCase(guildSettingsRepository);
    this.initGuildSettingsUC = new InitGuildSettingsUseCase(guildSettingsRepository);
  }

  async execute(guildId: string): Promise<GuildSettingsEntity> {
    logger.debug(`Ensuring guild exists: ${guildId}`);

    try {
      let settings = await this.getGuildSettingsUC.execute(guildId);

      if (!settings) {
        settings = await this.initGuildSettingsUC.execute(guildId);
      }

      return settings;
    } catch (error) {
      logger.error(`Failed to ensure guild exists: ${guildId}`, error as Error);
      throw error;
    }
  }
}
