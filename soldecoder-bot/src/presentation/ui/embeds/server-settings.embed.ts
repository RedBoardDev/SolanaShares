import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
// import { getTimezoneDisplayName } from '@presentation/ui/components/server-select.component';
// import { Timezone } from '@domain/value-objects/timezone';

export function buildServerSettingsEmbed(guildSettings: GuildSettingsEntity, globalChannelName?: string) {
  const embed = new EmbedBuilder()
    .setTitle('🔧 Server Settings')
    .setColor(0x5865F2);

  const generalSettings = [
    // `• **Timezone:** ${getTimezoneDisplayName(guildSettings.timezone as Timezone)}`,
    `• **Global Channel:** ${globalChannelName ? `#${globalChannelName}` : 'Not set'}`, // TODO: investigate why the channel name cannot be displayed correctly
    `• **Position Display:** ${guildSettings.positionDisplayEnabled ? '✅' : '❌'}`,
    `• **Auto-delete Warnings:** ${guildSettings.autoDeleteWarnings ? '✅' : '❌'}`,
    `• **Forward TP/SL to global channel:** ${guildSettings.forwardTpSl ? '✅' : '❌'}`,
    `• **Position Size Defaults:** ${guildSettings.positionSizeDefaults.walletAddress || guildSettings.positionSizeDefaults.stopLossPercent !== null ? `${guildSettings.positionSizeDefaults.walletAddress ?? 'no wallet'} • SL ${guildSettings.positionSizeDefaults.stopLossPercent ?? 'n/a'}%` : 'Not set'}`,
  ].join('\n');

  // const summarySettings = [
  //   `• **Daily Summary:** ${guildSettings.summaryPreferences.dailySummary ? '✅' : '❌'}`,
  //   `• **Weekly Summary:** ${guildSettings.summaryPreferences.weeklySummary ? '✅' : '❌'}`,
  //   `• **Monthly Summary:** ${guildSettings.summaryPreferences.monthlySummary ? '✅' : '❌'}`,
    // `• **Global Channel:** ${globalChannelName ? `#${globalChannelName}` : 'Not set'}`, // TODO: investigate why the channel name cannot be displayed correctly
  // ].join('\n');

  embed.addFields(
    {
      name: '📍 General Settings',
      value: generalSettings,
      inline: false,
    },
    // {
    //   name: '📈 Summary Settings',
    //   value: summarySettings,
    //   inline: false,
    // },
    {
      name: '🎛️ Advanced',
      value: '⚙️ **Manage Channels** → Configure individual channel settings',
      inline: false,
    }
  );

  return embed;
}

export function buildServerSettingsComponents() {
  const components: ActionRowBuilder<any>[] = [];

  const generalRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      // new ButtonBuilder() // TODO
      //   .setCustomId('server:timezone:select')
      //   .setLabel('Set Timezone')
      //   .setStyle(ButtonStyle.Primary)
      //   .setEmoji('🌍'),
      new ButtonBuilder()
        .setCustomId('server:toggle:autoDeleteWarnings')
        .setLabel('Toggle Warnings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🗑️')
      ,
      new ButtonBuilder()
        .setCustomId('server:position-size-defaults:openModal')
        .setLabel('Position Size Defaults')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📐')
    );

  // TODO Deuxième ligne: Summary Settings
  // const summaryRow = new ActionRowBuilder<ButtonBuilder>()
  //   .addComponents(
  //     new ButtonBuilder()
  //       .setCustomId('server:toggle:dailySummary')
  //       .setLabel('Daily')
  //       .setStyle(ButtonStyle.Secondary)
  //       .setEmoji('📅'),
  //     new ButtonBuilder()
  //       .setCustomId('server:toggle:weeklySummary')
  //       .setLabel('Weekly')
  //       .setStyle(ButtonStyle.Secondary)
  //       .setEmoji('📆'),
  //     new ButtonBuilder()
  //       .setCustomId('server:toggle:monthlySummary')
  //       .setLabel('Monthly')
  //       .setStyle(ButtonStyle.Secondary)
  //       .setEmoji('🗓️'),
  //   );

  const globalRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server:toggle:forwardTpSl')
        .setLabel('Toggle Global')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setCustomId('server:toggle:positionDisplay')
        .setLabel('Toggle Display')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('server:channel:select')
        .setLabel('Set Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝')
    );

  const navigationRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server:channels:manage')
        .setLabel('Manage Channels')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚙️')
    );

  components.push(generalRow, globalRow, navigationRow);
  return components;
}