import type { Guild } from 'discord.js';
import type { ChannelConfigRepository } from '@domain/interfaces/channel-config.repository.interface';
import type { PermissionValidator } from '@domain/interfaces/permission-validator.interface';
import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { ChannelAlreadyConfiguredError } from '@application/errors';

export class AddChannelConfigUseCase {
  constructor(
    private readonly channelConfigRepository: ChannelConfigRepository,
    private readonly permissionValidator: PermissionValidator,
  ) {}

  async execute(channelId: string, guild: Guild): Promise<ChannelConfigEntity> {
    const existingConfig = await this.channelConfigRepository.getByChannelId(channelId);
    if (existingConfig) {
      const channelName = guild.channels.cache.get(channelId)?.name;
      throw new ChannelAlreadyConfiguredError(channelId, channelName);
    }

    await this.permissionValidator.validateChannelAccess(guild, channelId);

    const defaultConfig = ChannelConfigEntity.createDefault(channelId, guild.id);
    await this.channelConfigRepository.save(defaultConfig);

    return defaultConfig;
  }
}
