import { GuildSettingsRepository } from '@domain/interfaces/guild-settings.repository.interface';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { logger } from '@helpers/logger';

export interface GuildSettingsUpdate {
  timezone?: string;
  positionDisplayEnabled?: boolean;
  autoDeleteWarnings?: boolean;
  globalChannelId?: string;
  forwardTpSl?: boolean;
  summaryPreferences?: {
    dailySummary?: boolean;
    weeklySummary?: boolean;
    monthlySummary?: boolean;
  };
  positionSizeDefaults?: {
    walletAddress?: string | null;
    stopLossPercent?: number | null;
  };
}

export class UpdateGuildSettingsUseCase {
  constructor(private readonly guildSettingsRepository: GuildSettingsRepository) {}

  async execute(guildId: string, updates: GuildSettingsUpdate): Promise<GuildSettingsEntity> {
    logger.debug(`Updating guild settings for guild ${guildId}`, { updates });

    try {
      const existingSettings = await this.guildSettingsRepository.getByGuildId(guildId);
      if (!existingSettings) {
        logger.warn(`Guild ${guildId} not found for update`);
        throw new Error('Guild settings not found');
      }

      const mergedSummaryPreferences = updates.summaryPreferences ? {
        dailySummary: updates.summaryPreferences.dailySummary !== undefined
          ? updates.summaryPreferences.dailySummary
          : existingSettings.summaryPreferences.dailySummary,
        weeklySummary: updates.summaryPreferences.weeklySummary !== undefined
          ? updates.summaryPreferences.weeklySummary
          : existingSettings.summaryPreferences.weeklySummary,
        monthlySummary: updates.summaryPreferences.monthlySummary !== undefined
          ? updates.summaryPreferences.monthlySummary
          : existingSettings.summaryPreferences.monthlySummary,
      } : existingSettings.summaryPreferences;

      const mergedPositionSizeDefaults = updates.positionSizeDefaults ? {
        walletAddress: updates.positionSizeDefaults.walletAddress !== undefined
          ? updates.positionSizeDefaults.walletAddress
          : existingSettings.positionSizeDefaults.walletAddress,
        stopLossPercent: updates.positionSizeDefaults.stopLossPercent !== undefined
          ? updates.positionSizeDefaults.stopLossPercent
          : existingSettings.positionSizeDefaults.stopLossPercent,
      } : existingSettings.positionSizeDefaults;

      const updatedSettings = GuildSettingsEntity.create({
        guildId: existingSettings.guildId,
        timezone: updates.timezone !== undefined ? updates.timezone : existingSettings.timezone,
        positionDisplayEnabled: updates.positionDisplayEnabled !== undefined
          ? updates.positionDisplayEnabled
          : existingSettings.positionDisplayEnabled,
        autoDeleteWarnings: updates.autoDeleteWarnings !== undefined
          ? updates.autoDeleteWarnings
          : existingSettings.autoDeleteWarnings,
        globalChannelId: updates.globalChannelId !== undefined
          ? updates.globalChannelId
          : existingSettings.globalChannelId,
        forwardTpSl: updates.forwardTpSl !== undefined
          ? updates.forwardTpSl
          : existingSettings.forwardTpSl,
        summaryPreferences: mergedSummaryPreferences,
        positionSizeDefaults: mergedPositionSizeDefaults,
        createdAt: existingSettings.createdAt,
      });

      await this.guildSettingsRepository.save(updatedSettings);

      return updatedSettings;
    } catch (error) {
      logger.error(`Failed to update guild settings for guild ${guildId}`, error as Error);
      throw error;
    }
  }
}
