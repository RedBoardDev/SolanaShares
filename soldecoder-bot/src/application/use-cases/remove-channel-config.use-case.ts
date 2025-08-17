import { ChannelNotFoundError } from '@application/errors/channel.errors';
import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import { logger } from '@helpers/logger';

export class RemoveChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string): Promise<void> {
    try {
      const existingConfig = await this.channelConfigRepository.getByChannelId(channelId);
      if (!existingConfig) {
        throw new ChannelNotFoundError(channelId);
      }

      await this.channelConfigRepository.delete(channelId);
    } catch (error) {
      logger.error(`Failed to remove channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }
}
