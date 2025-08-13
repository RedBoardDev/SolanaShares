import { EmbedBuilder } from 'discord.js';
import type { NftData } from '@schemas/nft-data.schema';

export function buildNftPriceEmbed(nftData: NftData, lastUpdated: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${nftData.name}`)
    .setColor(0x5865F2)
    .setThumbnail(nftData.image.small_2x)
    .setTimestamp(new Date(lastUpdated));

  const floorPrice = nftData.floor_price.native_currency;
  const floorPriceUsd = nftData.floor_price.usd;
  const currency = nftData.native_currency_symbol.toUpperCase();

  const change24h = nftData.floor_price_24h_percentage_change.native_currency;
  const change24hFormatted = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;

  embed.addFields({
    name: '💰 Floor Price',
    value: [
      `**${floorPrice.toFixed(4)} ${currency}**`,
      `($${floorPriceUsd.toFixed(2)} USD)`
    ].join('\n'),
    inline: true
  });

  const volume24h = nftData.volume_24h.native_currency;
  const sales24h = nftData.one_day_sales;

  embed.addFields({
    name: '📈 Market Stats',
    value: [
      `**Volume 24h:** ${volume24h.toFixed(2)} ${currency}`,
      `**Sales 24h:** ${sales24h}`,
      `**24h Change:** ${change24hFormatted}`
    ].join('\n'),
    inline: true
  });

  if (nftData.links) {
    const links = [];
    if (nftData.links.homepage) links.push(`[Website](${nftData.links.homepage})`);
    if (nftData.links.twitter) links.push(`[Twitter](${nftData.links.twitter})`);
    if (nftData.links.discord) links.push(`[Discord](${nftData.links.discord})`);

    if (links.length > 0) {
      embed.addFields({
        name: '🔗 Links',
        value: links.join(' • '),
        inline: false
      });
    }
  }

  const updateTime = new Date(lastUpdated).toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  embed.setFooter({
    text: `Data from CoinGecko • Last updated: ${updateTime} UTC`
  });

  return embed;
}

export function buildNftPriceErrorEmbed(collectionId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ NFT Data Unavailable')
    .setDescription(`Could not fetch NFT data for collection "${collectionId}".`)
    .addFields({
      name: '🔍 Possible Causes',
      value: [
        '• Collection ID not found on CoinGecko',
        '• API temporarily unavailable',
        '• Network connection issues'
      ].join('\n'),
      inline: false
    })
    .setColor(0xFF0000)
    .setTimestamp()
    .setFooter({ text: 'Try again in a few moments' });
}
