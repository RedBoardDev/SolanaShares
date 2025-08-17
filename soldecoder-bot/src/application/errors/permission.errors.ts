import { BaseApplicationError } from './base.error';

/**
 * Error thrown when bot lacks required Discord permissions
 */
export class BotPermissionError extends BaseApplicationError {
  constructor(missingPermissions: string[], channelId?: string, channelName?: string) {
    const permissionList = missingPermissions.join(', ');
    const locationInfo = channelName ? ` in #${channelName}` : channelId ? ' in channel' : '';

    const message = `Bot missing permissions: ${permissionList}${locationInfo}`;
    const userMessage = `❌ **Missing Permissions**: The bot needs **${permissionList}** permission${missingPermissions.length > 1 ? 's' : ''}${locationInfo} to work properly.`;

    super(message, userMessage, 'BOT_PERMISSION_ERROR', {
      missingPermissions,
      channelId,
      channelName,
    });
  }
}

/**
 * Error thrown when user lacks required Discord permissions
 */
export class UserPermissionError extends BaseApplicationError {
  constructor(requiredPermission: string) {
    const message = `User missing permission: ${requiredPermission}`;
    const userMessage = `❌ **Access Denied**: You need **${requiredPermission}** permission to use this feature.`;

    super(message, userMessage, 'USER_PERMISSION_ERROR', {
      requiredPermission,
    });
  }
}

/**
 * Error thrown when bot cannot access a channel
 */
export class ChannelAccessError extends BaseApplicationError {
  constructor(channelId: string, channelName?: string, reason?: string) {
    const locationInfo = channelName ? `#${channelName}` : `channel ${channelId}`;
    const reasonInfo = reason ? ` (${reason})` : '';

    const message = `Cannot access channel ${channelId}${reasonInfo}`;
    const userMessage = `❌ **Channel Access Error**: The bot cannot access ${locationInfo}${reasonInfo}. Please check bot permissions.`;

    super(message, userMessage, 'CHANNEL_ACCESS_ERROR', {
      channelId,
      channelName,
      reason,
    });
  }
}
