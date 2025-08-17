import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { SetupSessionData } from '@infrastructure/services/setup-session.service';
import { buildChannelSelectComponent } from '@presentation/ui/components/channel-select.component';
import { TimezoneHelper } from '@domain/value-objects/timezone';
import { buildBotGuideEmbed, buildBotGuideComponents } from '@presentation/ui/embeds/bot-guide.embed';

// Resume Setup Embed (when session already exists)
export function buildResumeSetupEmbed(session: SetupSessionData): EmbedBuilder {
  const timeRemaining = Math.max(0, 15 - Math.floor((Date.now() - session.startedAt) / (60 * 1000)));

  return new EmbedBuilder()
    .setTitle('🔄 Setup Session in Progress')
    .setDescription('**A configuration session is already active**')
    .addFields(
      {
        name: '📍 Current Progress',
        value: `**Step ${session.currentStep}/5** - ${getStepName(session.currentStep)}`,
        inline: false,
      },
      {
        name: '⏰ Time Remaining',
        value: `${timeRemaining} minutes before automatic expiration`,
        inline: false,
      },
      {
        name: '🔧 Available Options',
        value: [
          '• **Resume** - Continue where you left off',
          '• **Restart** - Start over from the beginning',
          '• **Cancel** - Delete the current session',
        ].join('\n'),
        inline: false,
      },
    )
    .setColor(0xffa500)
    .setFooter({ text: 'What would you like to do?' });
}

export function buildResumeSetupComponents(): ActionRowBuilder<any>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('setup:resume').setLabel('Resume').setStyle(ButtonStyle.Primary).setEmoji('▶️'),
      new ButtonBuilder()
        .setCustomId('setup:restart')
        .setLabel('Restart')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    ),
  ];
}

function getStepName(step: number): string {
  switch (step) {
    case 1:
      return 'Global channel selection';
    case 2:
      return 'Wallet & stop loss configuration';
    case 3:
      return 'Timezone selection';
    case 4:
      return 'Final summary';
    case 5:
      return 'Setup completion';
    default:
      return 'Unknown step';
  }
}

// Step 1: Channel Select
export function buildStep1Embed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🚀 Bot Setup - Step 1/5')
    .setDescription('**Global Channel Selection**')
    .addFields({
      name: '📝 Required Configuration',
      value: [
        '• Choose the main channel for global notifications',
        '• This channel will receive summaries and important alerts',
        '• You can configure other specific channels later',
      ].join('\n'),
    })
    .setColor(0x00ae86)
    .setFooter({ text: 'Step 1/5 • Select a channel to continue' });
}

export function buildStep1Components(): ActionRowBuilder<any>[] {
  return [
    buildChannelSelectComponent({
      customId: 'setup:step1:channel',
      placeholder: '📝 Select the main channel...',
      useNativeSelect: true,
    }),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    ),
  ];
}

// Step 2: Wallet + Stop Loss Modal
export function buildStep2Embed(session: SetupSessionData): EmbedBuilder {
  const channelMention = session.data.globalChannelId
    ? `<#${session.data.globalChannelId}>`
    : '❌ **No channel selected**';
  const walletConfigured = !!session.data.walletAddress;

  const embed = new EmbedBuilder()
    .setTitle('🚀 Bot Setup - Step 2/5')
    .setDescription('**Main Wallet Configuration**')
    .addFields({
      name: '✅ Selected Channel',
      value: channelMention,
      inline: false,
    })
    .setColor(0x00ae86);

  if (walletConfigured) {
    embed.addFields({
      name: '✅ Wallet Configuration Complete',
      value: [
        `**Main Wallet**: \`${session.data.walletAddress?.slice(0, 8)}...${session.data.walletAddress?.slice(-8)}\``,
        `**Stop Loss**: ${session.data.stopLossPercent ? `${session.data.stopLossPercent}%` : 'Not set'}`,
        '',
        '🎯 **Ready to continue to timezone selection!**',
      ].join('\n'),
    });
    embed.setFooter({ text: 'Step 2/5 • Wallet configured - Continue to next step' });
  } else {
    embed.addFields({
      name: '💰 Wallet & Stop Loss Setup',
      value: [
        '• **Main Wallet**: Required Solana address for tracking',
        '• **Stop Loss**: Optional percentage (e.g. 10 for -10%)',
        '• These parameters will be used as defaults for commands',
      ].join('\n'),
    });
    embed.setFooter({ text: 'Step 2/5 • Click the button to configure' });
  }

  return embed;
}

export function buildStep2Components(walletConfigured = false): ActionRowBuilder<any>[] {
  if (walletConfigured) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('setup:step2:continue')
          .setLabel('Continue to Timezone')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️'),
        new ButtonBuilder()
          .setCustomId('setup:step2:wallet_modal')
          .setLabel('Reconfigure Wallet')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('setup:step2:wallet_modal')
        .setLabel('Configure Wallet')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💰'),
      new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    ),
  ];
}

export function buildWalletStopLossModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('setup:step2:wallet_submit')
    .setTitle('Wallet & Stop Loss Configuration')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('wallet_address')
          .setLabel('Main Wallet Address')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
          .setRequired(true)
          .setMaxLength(44)
          .setMinLength(32),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('stop_loss_percent')
          .setLabel('Default Stop Loss (%) - Optional')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 10 (for -10%)')
          .setRequired(false)
          .setMaxLength(5),
      ),
    );
}

// Step 3: Timezone Select (moved from step 4)
export function buildStep3Embed(session: SetupSessionData): EmbedBuilder {
  const channelMention = session.data.globalChannelId
    ? `<#${session.data.globalChannelId}>`
    : '❌ **No channel selected**';

  return new EmbedBuilder()
    .setTitle('🚀 Bot Setup - Step 3/5')
    .setDescription('**Timezone Selection**')
    .addFields(
      {
        name: '✅ Current Configuration',
        value: [
          `**Channel:** ${channelMention}`,
          `**Wallet:** \`${session.data.walletAddress?.slice(0, 8)}...${session.data.walletAddress?.slice(-8)}\``,
          session.data.stopLossPercent ? `**Stop Loss:** ${session.data.stopLossPercent}%` : '**Stop Loss:** Not set',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🌍 Timezone',
        value: [
          '• Select your primary timezone',
          '• Used for reports and time-based notifications',
          '• IANA standard format (e.g. Europe/Paris)',
        ].join('\n'),
      },
    )
    .setColor(0x00ae86)
    .setFooter({ text: 'Step 3/5 • Select your timezone' });
}

export function buildStep3Components(): ActionRowBuilder<any>[] {
  const timezones = TimezoneHelper.all();

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:step3:timezone')
        .setPlaceholder('🌍 Select your timezone...')
        .addOptions(
          timezones.map((tz) => ({
            label: tz.name,
            value: tz.value,
            description: `Timezone: ${tz.value}`,
          })),
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('setup:back:2').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️'),
      new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    ),
  ];
}

// Step 4: Final Summary (moved from step 5)
export function buildStep4Embed(session: SetupSessionData): EmbedBuilder {
  const channelMention = session.data.globalChannelId
    ? `<#${session.data.globalChannelId}>`
    : '❌ **No channel selected**';

  return new EmbedBuilder()
    .setTitle('🚀 Bot Setup - Step 4/5')
    .setDescription('**Configuration Summary**')
    .addFields({
      name: '📝 Complete Configuration',
      value: [
        `**Main Channel:** ${channelMention}`,
        `**Wallet:** \`${session.data.walletAddress?.slice(0, 8)}...${session.data.walletAddress?.slice(-8)}\``,
        `**Stop Loss:** ${session.data.stopLossPercent ? `${session.data.stopLossPercent}%` : 'Not set'}`,
        `**Timezone:** ${session.data.timezone}`,
      ].join('\n'),
      inline: false,
    })
    .setColor(0x00ae86)
    .setFooter({ text: 'Step 4/5 • Review and validate your configuration' });
}

export function buildStep4Components(): ActionRowBuilder<any>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('setup:back:3').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️'),
      new ButtonBuilder()
        .setCustomId('setup:step4:confirm')
        .setLabel('Validate & Finalize')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder().setCustomId('setup:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    ),
  ];
}

// Step 5: Final Guide (moved from step 6)
export function buildStep5Embed(): EmbedBuilder {
  const embed = buildBotGuideEmbed();

  embed.setTitle('🎉 Configuration Complete!');
  embed.setDescription("**Your server has been successfully configured! Here's your complete guide:**");
  embed.setFooter({ text: 'Setup complete • Start by configuring your first channels!' });

  return embed;
}

export function buildStep5Components(): ActionRowBuilder<any>[] {
  return buildBotGuideComponents();
}
