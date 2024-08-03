import { EmbedBuilder } from 'discord.js';

type PositionSizeItem = {
  positions: number;
  size: number;
  sl: number;
  delta?: number | null;
};

function numEmoji(n: number): string {
  const map: Record<number, string> = { 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣' };
  return map[n] || `${n}`;
}

function trendIcon(delta: number): string {
  if (delta > 0.01) return '🔺';
  if (delta < -0.01) return '🔻';
  return '➖';
}

export function buildPositionSizeEmbed(params: {
  shortWallet: string;
  netWorth: number;
  stoploss: number;
  currentSize?: number | null;
  items: PositionSizeItem[];
}) {
  const { shortWallet, netWorth, stoploss, currentSize, items } = params;

  const fields = items.map(({ positions, size, sl, delta }) => {
    const parts: string[] = [
      `Size: **${size.toFixed(2)} SOL**`,
      `SL: ${sl.toFixed(2)} SOL`,
    ];
    if (delta !== null && delta !== undefined) {
      const sign = delta >= 0 ? '+' : '';
      parts.push(`${trendIcon(delta)} ${sign}${delta.toFixed(2)}%`);
    }
    return {
      name: `${numEmoji(positions)} ${positions} position${positions > 1 ? 's' : ''}`,
      value: parts.join(' • '),
      inline: false,
    } as const;
  });

  const embed = new EmbedBuilder()
    .setTitle('📐 Position Size Recommendations')
    .setColor(0x5865F2)
    .setDescription([
      `Wallet: ${shortWallet} • Net worth: ${netWorth.toFixed(2)} SOL`,
      `Stop Loss: ${stoploss}%${currentSize ? ` • Current size: ${currentSize.toFixed(2)} SOL` : ''}`,
    ].join('\n'))
    .addFields(fields)
    .setTimestamp();

  return embed;
}
