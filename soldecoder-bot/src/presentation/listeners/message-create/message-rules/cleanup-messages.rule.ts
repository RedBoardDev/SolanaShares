import type { Message } from 'discord.js';
import type { MessageRule } from '@domain/interfaces/message-rule.interface';
import { logger } from '@helpers/logger';

export class CleanupMessagesRule implements MessageRule {
  public readonly id = 'cleanup-messages';
  public readonly name = 'Cleanup Messages Handler';
  public readonly exclusive = true;

  private readonly patternsToDelete = [
    '⚠️ **Pool Search Timeout Alert** ⚠️',
    '⚙️ **Pool Search Alert (Part 2/2)**'
  ];

  public matches(message: Message): boolean {
    const trimmedContent = message.content.trim();
    const matchedPattern = this.patternsToDelete.find(pattern =>
      trimmedContent.startsWith(pattern)
    );

    return !!matchedPattern;
  }

  public async execute(message: Message): Promise<void> {
    try {
      await message.delete();
    } catch (error) {
      logger.error('Failed to delete cleanup message', error instanceof Error ? error : new Error(String(error)));

      if (message.channel?.isSendable()) {
        try {
          await message.channel.send('⚠️ **Cleanup Warning**: Unable to delete alert message. Please check bot permissions.');
        } catch (sendError) {
          logger.error('Failed to send cleanup warning message', sendError instanceof Error ? sendError : new Error(String(sendError)));
        }
      }
    }
  }
}