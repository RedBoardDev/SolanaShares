import type { Message } from 'discord.js';
import type { MessageRule } from '@domain/interfaces/message-rule.interface';
import type { MessageDispatcher } from '@domain/interfaces/message-dispatcher.interface';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { logger } from '@helpers/logger';

export class MessageDispatcherService implements MessageDispatcher {
  private static instance: MessageDispatcherService;
  private rules: Map<string, MessageRule> = new Map();
  private channelRepo: DynamoChannelConfigRepository;

  private constructor() {
    this.channelRepo = new DynamoChannelConfigRepository();
  }

  public static getInstance(): MessageDispatcherService {
    if (!MessageDispatcherService.instance) {
      MessageDispatcherService.instance = new MessageDispatcherService();
    }
    return MessageDispatcherService.instance;
  }

  public registerRule(rule: MessageRule): void {
    if (this.rules.has(rule.id)) {
      logger.warn(`Rule with ID ${rule.id} already exists, overwriting`);
    }

    this.rules.set(rule.id, rule);
  }

  public unregisterRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
    } else {
      logger.warn(`Attempted to unregister non-existent rule: ${ruleId}`);
    }
  }

  public getRules(): MessageRule[] {
    return Array.from(this.rules.values());
  }

  public async processMessage(message: Message): Promise<void> {
    try {
      const isChannelFollowed = await this.channelRepo.exists(message.channelId);
      if (!isChannelFollowed) {
        return;
      }

      const rules = Array.from(this.rules.values());

      for (const rule of rules) {
        try {
          if (rule.matches(message)) {
            await rule.execute(message);

            if (rule.exclusive) {
              break;
            }
          }
        } catch (error) {
          logger.error(`Error executing rule "${rule.name}"`, error instanceof Error ? error : new Error(String(error)));
        }
      }
    } catch (error) {
      logger.error('Error in message dispatcher', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
