import { type CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { logger } from '@helpers/logger';

export function isUserAdmin(interaction: CommandInteraction): boolean {
  try {
    if (!interaction.guild || !interaction.member) {
      logger.debug('Interaction not in guild or member not found');
      return false;
    }

    const memberPermissions = interaction.memberPermissions;

    if (!memberPermissions) {
      logger.debug('Member permissions not available');
      return false;
    }

    const hasAdminPermission = memberPermissions.has(PermissionFlagsBits.Administrator);
    const hasManageServerPermission = memberPermissions.has(PermissionFlagsBits.ManageGuild);

    const isAdmin = hasAdminPermission || hasManageServerPermission;

    logger.debug(`User ${interaction.user.id} admin check: ${isAdmin} (Admin: ${hasAdminPermission}, ManageServer: ${hasManageServerPermission})`);

    return isAdmin;
  } catch (error) {
    logger.error('Error checking admin permissions', error as Error);
    return false;
  }
}

export async function replyAdminOnly(interaction: CommandInteraction): Promise<void> {
  await interaction.reply({
    content: '❌ This command is only available to server administrators.',
    ephemeral: true
  });
}
