export interface ChannelConfig {
  channelId: string;
  guildId: string;
  image: boolean;
  notifyOnClose: boolean;
  pin: boolean;
  tagType: 'USER' | 'ROLE' | 'NONE';
  tagId: string;
  threshold: number;
  createdAt: number;
}

export class ChannelConfigEntity implements ChannelConfig {
  constructor(
    public readonly channelId: string,
    public readonly guildId: string,
    public readonly image: boolean,
    public readonly notifyOnClose: boolean,
    public readonly pin: boolean,
    public readonly tagType: 'USER' | 'ROLE' | 'NONE',
    public readonly tagId: string,
    public readonly threshold: number,
    public readonly createdAt: number,
  ) {}

  static create(params: ChannelConfig): ChannelConfigEntity {
    return new ChannelConfigEntity(
      params.channelId,
      params.guildId,
      params.image,
      params.notifyOnClose,
      params.pin,
      params.tagType,
      params.tagId,
      params.threshold,
      params.createdAt,
    );
  }

  static createDefault(channelId: string, guildId: string): ChannelConfigEntity {
    return new ChannelConfigEntity(
      channelId,
      guildId,
      false, // image
      false, // notifyOnClose
      false, // pin
      'NONE', // tagType
      '', // tagId
      0, // threshold
      Date.now(), // createdAt
    );
  }
}
