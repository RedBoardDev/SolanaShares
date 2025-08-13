import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { logger } from '@helpers/logger';

export class GetGuildChannelsUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(guildId: string): Promise<ChannelConfigEntity[]> {
    logger.debug(`Getting channel configs for guild ${guildId}`);

    try {
      const configs = await this.channelConfigRepository.getByGuildId(guildId);

      logger.debug(`Found ${configs.length} channel configs for guild ${guildId}`);

      return configs;
    } catch (error) {
      logger.error(`Failed to get channel configs for guild ${guildId}`, error as Error);
      throw error;
    }
  }
}
