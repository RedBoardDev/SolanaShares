import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
import { getTimezoneDisplayName } from '@presentation/ui/components/server-select.component';
import type { Timezone } from '@domain/value-objects/timezone';

export function buildServerSettingsEmbed(guildSettings: GuildSettingsEntity, globalChannelName?: string) {
  const embed = new EmbedBuilder()
    .setTitle('🔧 Server Configuration')
    .setDescription('**Manage your bot settings and global channel configuration**')
    .setColor(0x5865F2);

  const mainSettings = [
    `• **Global Channel:** ${globalChannelName ? `#${globalChannelName}` : 'Not configured'}`,
    `• **Timezone:** ${getTimezoneDisplayName(guildSettings.timezone as Timezone)}`,
    `• **Position Display:** ${guildSettings.positionDisplayEnabled ? '✅ Enabled' : '❌ Disabled'}`,
    `• **Forward TP/SL:** ${guildSettings.forwardTpSl ? '✅ Enabled' : '❌ Disabled'}`,
  ].join('\n');

  const systemSettings = [
    `• **Auto-delete Warnings:** ${guildSettings.autoDeleteWarnings ? '✅ Enabled' : '❌ Disabled'}`,
    `• **Position Size Defaults:** ${guildSettings.positionSizeDefaults.walletAddress || guildSettings.positionSizeDefaults.stopLossPercent !== null ?
      `Wallet: \`${guildSettings.positionSizeDefaults.walletAddress?.slice(0, 8)}...\` • Stop Loss: ${guildSettings.positionSizeDefaults.stopLossPercent ?? 'Not set'}%` :
      'Not configured'}`,
  ].join('\n');

  embed.addFields(
    {
      name: '📊 Main Configuration',
      value: mainSettings,
      inline: false,
    },
    {
      name: '⚙️ System Settings',
      value: systemSettings,
      inline: false,
    },
    {
      name: '💡 Settings Explanation',
      value: [
        '• **Position Display**: Shows position summaries from followed channels in global channel',
        '• **Forward TP/SL**: Sends take-profit and stop-loss alerts to global channel',
        '• **Auto-delete Warnings**: Automatically removes bot warning messages after 10 seconds',
        '• **Position Size Defaults**: Default wallet and stop-loss for `/position-size` command'
      ].join('\n'),
      inline: false,
    },
    {
      name: '🔗 Quick Access',
      value: '📋 **Manage Channels** → Use buttons below to configure followed channels',
      inline: false,
    }
  );

  return embed;
}

export function buildServerSettingsComponents(guildSettings: GuildSettingsEntity) {
  const components: ActionRowBuilder<any>[] = [];

  const mainConfigRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server:toggle:positionDisplay')
        .setLabel(guildSettings.positionDisplayEnabled ? 'Disable Position Display' : 'Enable Position Display')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('server:toggle:forwardTpSl')
        .setLabel(guildSettings.forwardTpSl ? 'Disable Forward TP/SL' : 'Enable Forward TP/SL')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('server:channel:select')
        .setLabel('Change Global Channel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝')
    );

  const systemConfigRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server:toggle:autoDeleteWarnings')
        .setLabel(guildSettings.autoDeleteWarnings ? 'Disable Auto-delete Warnings' : 'Enable Auto-delete Warnings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('server:position-size-defaults:openModal')
        .setLabel('Edit Position Defaults')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💰')
    );

  const navigationRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server:channels:manage')
        .setLabel('📋 Manage Followed Channels')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️')
    );

  components.push(mainConfigRow, systemConfigRow, navigationRow);
  return components;
}