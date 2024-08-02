import { ActionRowBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';

export function buildUserSelectComponent(channelId: string) {
  const userSelectRow = new ActionRowBuilder<UserSelectMenuBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`tag:user:${channelId}`)
        .setPlaceholder('Select a user to tag')
        .setMinValues(1)
        .setMaxValues(1)
    );

  return userSelectRow;
}

export function buildRoleSelectComponent(channelId: string) {
  const roleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
    .addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`tag:role:${channelId}`)
        .setPlaceholder('Select a role to tag')
        .setMinValues(1)
        .setMaxValues(1)
    );

  return roleSelectRow;
}