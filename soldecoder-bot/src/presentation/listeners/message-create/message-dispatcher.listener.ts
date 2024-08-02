import type { Client, Message } from 'discord.js';
import { MessageDispatcherService } from '@infrastructure/services/message-dispatcher.service';
import { logger } from '@helpers/logger';
import { CleanupMessagesRule, ClosedMessageRule } from './message-rules';

export function registerMessageDispatcherListener(client: Client) {
  const dispatcher = MessageDispatcherService.getInstance();

  dispatcher.registerRule(new CleanupMessagesRule());
  dispatcher.registerRule(new ClosedMessageRule());

  client.on('messageCreate', onMessageCreate);
  logger.info('Message dispatcher listener registered');
}

async function onMessageCreate(message: Message) {
  try {
    if (message.author.id === message.client.user?.id) return;
    if (!message.guildId) return;

    const dispatcher = MessageDispatcherService.getInstance();
    await dispatcher.processMessage(message);

  } catch (error) {
    logger.error('Error in message dispatcher listener', error instanceof Error ? error : new Error(String(error)));
  }
}
