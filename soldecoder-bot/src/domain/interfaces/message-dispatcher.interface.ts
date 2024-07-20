import type { Message } from 'discord.js';
import type { MessageRule } from './message-rule.interface';

export interface MessageDispatcher {
  /** Register a new message rule */
  registerRule(rule: MessageRule): void;

  /** Unregister a message rule by ID */
  unregisterRule(ruleId: string): void;

  /** Get all registered rules */
  getRules(): MessageRule[];

  /** Process a message through all matching rules */
  processMessage(message: Message): Promise<void>;
}
