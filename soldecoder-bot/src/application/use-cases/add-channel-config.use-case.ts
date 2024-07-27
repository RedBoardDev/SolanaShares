import { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { logger } from '@helpers/logger';

export class AddChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string, guildId: string): Promise<ChannelConfigEntity> {
    logger.debug(`Adding channel config for channel ${channelId} in guild ${guildId}`);

    try {
      const existingConfig = await this.channelConfigRepository.getByChannelId(channelId);
      if (existingConfig) {
        logger.warn(`Channel ${channelId} already configured`);
        throw new Error('Channel is already being followed');
      }

      const defaultConfig = ChannelConfigEntity.createDefault(channelId, guildId);

      await this.channelConfigRepository.save(defaultConfig);

      return defaultConfig;
    } catch (error) {
      logger.error(`Failed to add channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }
}
