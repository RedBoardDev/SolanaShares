import type { Message } from 'discord.js';

export interface MessageRule {
  /** Unique identifier for the rule */
  id: string;

  /** Human readable name for the rule */
  name: string;

  /** Function to determine if the rule should be applied to a message */
  matches(message: Message): boolean;

  /** Function to execute when the rule matches */
  execute(message: Message): Promise<void>;

  /** Whether this rule should prevent other rules from executing */
  exclusive?: boolean;
}
