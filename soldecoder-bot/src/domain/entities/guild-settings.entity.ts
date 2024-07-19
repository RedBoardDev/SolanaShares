export interface SummaryPreferences {
  dailySummary: boolean;
  weeklySummary: boolean;
  monthlySummary: boolean;
}

export interface GuildSettings {
  guildId: string;
  timezone: string;
  positionDisplayEnabled: boolean;
  autoDeleteWarnings: boolean;
  globalChannelId: string;
  forwardTpSl: boolean;
  summaryPreferences: SummaryPreferences;
  positionSizeDefaults: {
    walletAddress: string | null;
    stopLossPercent: number | null;
  };
  createdAt: number;
}

export class GuildSettingsEntity implements GuildSettings {
  constructor(
    public readonly guildId: string,
    public readonly timezone: string,
    public readonly positionDisplayEnabled: boolean,
    public readonly autoDeleteWarnings: boolean,
    public readonly globalChannelId: string,
    public readonly forwardTpSl: boolean,
    public readonly summaryPreferences: SummaryPreferences,
    public readonly positionSizeDefaults: { walletAddress: string | null; stopLossPercent: number | null },
    public readonly createdAt: number,
  ) {}

  static create(params: GuildSettings): GuildSettingsEntity {
    return new GuildSettingsEntity(
      params.guildId,
      params.timezone,
      params.positionDisplayEnabled,
      params.autoDeleteWarnings,
      params.globalChannelId,
      params.forwardTpSl,
      params.summaryPreferences,
      params.positionSizeDefaults,
      params.createdAt,
    );
  }

  static createDefault(guildId: string): GuildSettingsEntity {
    return new GuildSettingsEntity(
      guildId,
      'UTC', // timezone
      false, // positionDisplayEnabled
      false, // autoDeleteWarnings
      '', // globalChannelId
      false, // forwardTpSl
      {
        dailySummary: false,
        weeklySummary: false,
        monthlySummary: false,
      },
      { walletAddress: null, stopLossPercent: null },
      Date.now(), // createdAt
    );
  }
}
