import { BaseApplicationError } from './base.error';

/**
 * Error thrown when trying to add a channel that's already configured
 */
export class ChannelAlreadyConfiguredError extends BaseApplicationError {
  constructor(channelId: string, channelName?: string) {
    const locationInfo = channelName ? `#${channelName}` : 'this channel';

    const message = `Channel ${channelId} is already configured`;
    const userMessage = `❌ **Already Configured**: ${locationInfo} is already being followed by the bot.`;

    super(message, userMessage, 'CHANNEL_ALREADY_CONFIGURED', {
      channelId,
      channelName,
    });
  }
}

/**
 * Error thrown when trying to access a channel that doesn't exist or is invalid
 */
export class ChannelNotFoundError extends BaseApplicationError {
  constructor(channelId: string) {
    const message = `Channel ${channelId} not found or not accessible`;
    const userMessage = '❌ **Channel Not Found**: The selected channel is not accessible or no longer exists.';

    super(message, userMessage, 'CHANNEL_NOT_FOUND', {
      channelId,
    });
  }
}

/**
 * Error thrown when channel is not a text channel
 */
export class InvalidChannelTypeError extends BaseApplicationError {
  constructor(channelId: string, actualType: string, channelName?: string) {
    const locationInfo = channelName ? `#${channelName}` : `channel ${channelId}`;

    const message = `Channel ${channelId} is ${actualType}, expected text channel`;
    const userMessage = `❌ **Invalid Channel Type**: ${locationInfo} must be a text channel. Please select a text channel instead.`;

    super(message, userMessage, 'INVALID_CHANNEL_TYPE', {
      channelId,
      channelName,
      actualType,
    });
  }
}

/**
 * Error thrown when trying to enable a feature that requires specific permissions
 */
export class ChannelFeaturePermissionError extends BaseApplicationError {
  constructor(feature: string, missingPermissions: string[], channelId: string, channelName?: string) {
    const locationInfo = channelName ? `#${channelName}` : `channel ${channelId}`;
    const permissionList = missingPermissions.join(', ');

    const message = `Cannot enable ${feature} feature: bot missing ${permissionList} in ${channelId}`;
    const userMessage = `❌ **Cannot Enable ${feature}**: The bot needs **${permissionList}** permission${missingPermissions.length > 1 ? 's' : ''} in ${locationInfo} to use this feature.`;

    super(message, userMessage, 'CHANNEL_FEATURE_PERMISSION_ERROR', {
      feature,
      missingPermissions,
      channelId,
      channelName,
    });
  }
}

/**
 * Error thrown when trying to configure mentions without proper permissions
 */
export class MentionPermissionError extends BaseApplicationError {
  constructor(mentionType: 'USER' | 'ROLE', channelId: string, channelName?: string) {
    const locationInfo = channelName ? `#${channelName}` : `channel ${channelId}`;
    const typeText = mentionType === 'USER' ? 'user' : 'role';

    const message = `Cannot configure ${typeText} mentions in ${channelId}: bot missing permissions`;
    const userMessage = `❌ **Cannot Configure ${typeText.charAt(0).toUpperCase() + typeText.slice(1)} Mentions**: The bot needs **Send Messages** permission in ${locationInfo} to send notifications with mentions.`;

    super(message, userMessage, 'MENTION_PERMISSION_ERROR', {
      mentionType,
      channelId,
      channelName,
    });
  }
}
