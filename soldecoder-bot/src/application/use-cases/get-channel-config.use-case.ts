import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { logger } from '@helpers/logger';

export class GetChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string): Promise<ChannelConfigEntity | null> {
    logger.debug(`Getting channel config for channel ${channelId}`);

    try {
      const config = await this.channelConfigRepository.getByChannelId(channelId);

      if (config) {
        logger.debug(`Channel config found for channel ${channelId}`);
      } else {
        logger.debug(`No channel config found for channel ${channelId}`);
      }

      return config;
    } catch (error) {
      logger.error(`Failed to get channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }
}
