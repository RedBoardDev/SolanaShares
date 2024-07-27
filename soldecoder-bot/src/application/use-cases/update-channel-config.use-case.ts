import { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { logger } from '@helpers/logger';

export interface ChannelConfigUpdate {
  image?: boolean;
  notifyOnClose?: boolean;
  pin?: boolean;
  tagType?: 'USER' | 'ROLE' | 'NONE';
  tagId?: string;
  threshold?: number;
}

export class UpdateChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string, updates: ChannelConfigUpdate): Promise<ChannelConfigEntity> {
    logger.debug(`Updating channel config for channel ${channelId}`, { updates });

    try {
      const existingConfig = await this.channelConfigRepository.getByChannelId(channelId);
      if (!existingConfig) {
        logger.warn(`Channel ${channelId} not found for update`);
        throw new Error('Channel is not being followed');
      }

      const updatedConfig = ChannelConfigEntity.create({
        channelId: existingConfig.channelId,
        guildId: existingConfig.guildId,
        image: updates.image !== undefined ? updates.image : existingConfig.image,
        notifyOnClose: updates.notifyOnClose !== undefined ? updates.notifyOnClose : existingConfig.notifyOnClose,
        pin: updates.pin !== undefined ? updates.pin : existingConfig.pin,
        tagType: updates.tagType !== undefined ? updates.tagType : existingConfig.tagType,
        tagId: updates.tagId !== undefined ? updates.tagId : existingConfig.tagId,
        threshold: updates.threshold !== undefined ? updates.threshold : existingConfig.threshold,
        createdAt: existingConfig.createdAt,
      });

      await this.channelConfigRepository.save(updatedConfig);

      return updatedConfig;
    } catch (error) {
      logger.error(`Failed to update channel config for channel ${channelId}`, error as Error);
      throw error;
    }
  }
}
