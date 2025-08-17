import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function buildThresholdModal(channelId: string, currentThreshold: number) {
  const modal = new ModalBuilder()
    .setCustomId(`threshold:submit:${channelId}`)
    .setTitle('Set Threshold Percentage');

  const thresholdInput = new TextInputBuilder()
    .setCustomId('threshold_value')
    .setLabel('Threshold (±%)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter threshold percentage (e.g., 0.09)')
    .setValue(currentThreshold.toString())
    .setMinLength(1)
    .setMaxLength(6)
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(thresholdInput);
  modal.addComponents(actionRow);

  return modal;
}

export function validateThreshold(input: string): { isValid: boolean; value?: number; error?: string } {
  const trimmed = input.trim();

  const num = Number.parseFloat(trimmed);
  if (Number.isNaN(num)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }

  if (num < 0 || num > 100) {
    return { isValid: false, error: 'Threshold must be between 0 and 100%' };
  }

  const rounded = Math.round(num * 100) / 100;

  return { isValid: true, value: rounded };
}
