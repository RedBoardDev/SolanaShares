import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';

export interface ChannelConfigRepository {
  /** Retrieve the configuration of a channel */
  getByChannelId(channelId: string): Promise<ChannelConfigEntity | null>;

  /** Retrieve all channel configurations for a guild */
  getByGuildId(guildId: string): Promise<ChannelConfigEntity[]>;

  /** Create or update the configuration of a channel */
  save(channelConfig: ChannelConfigEntity): Promise<void>;

  /** Delete the configuration of a channel */
  delete(channelId: string): Promise<void>;

  /** Check if a channel is configured */
  exists(channelId: string): Promise<boolean>;

  /** Retrieve all configured channels */
  getAll(): Promise<ChannelConfigEntity[]>;
}
