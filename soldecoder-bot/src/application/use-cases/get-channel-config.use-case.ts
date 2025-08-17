import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';

export class GetChannelConfigUseCase {
  constructor(private readonly channelConfigRepository: ChannelConfigRepository) {}

  async execute(channelId: string): Promise<ChannelConfigEntity | null> {
    const config = await this.channelConfigRepository.getByChannelId(channelId);
    return config;
  }
}
