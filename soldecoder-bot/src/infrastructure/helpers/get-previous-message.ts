import { ChannelType, type TextChannel, type Message } from 'discord.js';
import { logger } from '@helpers/logger';

export async function getPreviousMessage(message: Message): Promise<Message | null> {
  if (message.channel.type !== ChannelType.GuildText) return null;
  try {
    const msgs = await (message.channel as TextChannel).messages.fetch({
      before: message.id,
      limit: 1,
    });
    return msgs.first() ?? null;
  } catch (err) {
    logger.warn('Failed to fetch previous message', {
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return null;
  }
}
