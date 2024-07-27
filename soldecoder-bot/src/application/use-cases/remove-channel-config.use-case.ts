import { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import { logger } from '@helpers/logger';

export class RemoveChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string): Promise<void> {
    logger.debug(`Removing channel config for channel ${channelId}`);

    try {
      const existingConfig = await this.channelConfigRepository.getByChannelId(channelId);
      if (!existingConfig) {
        logger.warn(`Channel ${channelId} not found for removal`);
        throw new Error('Channel is not being followed');
      }

      await this.channelConfigRepository.delete(channelId);

    } catch (error) {
      logger.error(`Failed to remove channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }
}
