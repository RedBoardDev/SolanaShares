import { EmbedBuilder } from 'discord.js';
import { config } from '@infrastructure/config/env';

export interface PhaseStatus {
  isRegistrationActive: boolean;
  daysUntilStart: number;
  endDate: Date;
  startDate: Date;
  durationMonths: number;
}

export function generateActiveDepositEmbed(phaseStatus: PhaseStatus): EmbedBuilder {
  const solscanUrl = `https://solscan.io/account/${config.solana.phase.wallet}`;

  const deadline = phaseStatus.endDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) + ' at ' + phaseStatus.endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return new EmbedBuilder()
    .setColor(0x9945ff)
    .setTitle('💰 SOL Deposit Information - REGISTRATION ACTIVE')
    .addFields(
      {
        name: '🏦 Deposit Address',
        value: `\`\`\`${config.solana.phase.wallet}\`\`\``,
        inline: false,
      },
      {
        name: '⏰ Registration Deadline',
        value: `**${deadline}**`,
        inline: true,
      },
      {
        name: '📅 Days Until Start',
        value: `**${phaseStatus.daysUntilStart} days**`,
        inline: true,
      },
      {
        name: '📊 Phase Duration',
        value: `**${phaseStatus.durationMonths} months**`,
        inline: true,
      },
      {
        name: '⚠️ Important',
        value: '**After the deadline, all funds will be returned and will not be counted!**',
        inline: false,
      },
      {
        name: '🔍 Verification',
        value: `[View on Solscan](${solscanUrl})`,
        inline: true,
      },
      {
        name: '⚡ Instructions',
        value:
          '• **Verify the address** before sending\n' +
          '• **Double-check** on Solscan\n' +
          '• **Respect the deadline**\n' +
          '• **Keep transaction proof**',
        inline: false,
      },
    )
    .setFooter({
      text: '✅ Registration is currently ACTIVE - Verify address before sending!',
    })
    .setTimestamp();
}

export function generateClosedDepositEmbed(phaseStatus: PhaseStatus): EmbedBuilder {
  const startDate = phaseStatus.startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🚫 SOL Deposits CLOSED - Phase Running')
    .addFields(
      {
        name: '⚠️ IMPORTANT NOTICE',
        value: `**Registration phase is now CLOSED**\n**Phase Running** - Started on ${startDate} (${phaseStatus.durationMonths} months duration)\n**Any tokens sent will NOT be counted or tracked**\n\n⛔ **DO NOT SEND TOKENS** ⛔`,
        inline: false,
      },
      {
        name: '❌ What this means:',
        value:
          '• **No new deposits accepted**\n' +
          '• **Sent tokens will be ignored**\n' +
          '• **No tracking or counting**\n' +
          '• **Funds may be lost**',
        inline: false,
      },
      {
        name: '📞 Need Help?',
        value: 'Contact the team if you have questions about the current phase or your existing investments.',
        inline: false,
      },
    )
    .setFooter({
      text: '🚫 REGISTRATION CLOSED - Phase is running, tokens sent will NOT be counted',
    })
    .setTimestamp();
}
