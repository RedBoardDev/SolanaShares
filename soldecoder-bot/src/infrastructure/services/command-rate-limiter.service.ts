import { logger } from '@helpers/logger';
import { config } from '@infrastructure/config/env';
import type { Interaction } from 'discord.js';

type CommandKey = string;
type UserId = string;

type UsageEntry = {
  last: number;
  windowMs: number;
};

export class CommandRateLimiterService {
  private static instance: CommandRateLimiterService;
  private readonly usageMap: Map<CommandKey, Map<UserId, UsageEntry>> = new Map();
  private readonly SWEEP_INTERVAL_MS = 15 * 60_000;

  private constructor() {
    setInterval(() => this.cleanup(), this.SWEEP_INTERVAL_MS).unref();
  }

  static getInstance(): CommandRateLimiterService {
    if (!CommandRateLimiterService.instance) {
      CommandRateLimiterService.instance = new CommandRateLimiterService();
    }
    return CommandRateLimiterService.instance;
  }

  tryConsume(commandKey: CommandKey, userId: UserId, limitMs: number): { allowed: boolean; retryAfterMs?: number } {
    if (config.discordAdminUserId && userId === config.discordAdminUserId) {
      return { allowed: true };
    }

    const now = Date.now();
    let perUser = this.usageMap.get(commandKey);
    if (!perUser) {
      perUser = new Map<UserId, UsageEntry>();
      this.usageMap.set(commandKey, perUser);
    }

    const entry = perUser.get(userId);
    const last = entry?.last ?? 0;
    const elapsed = now - last;
    if (elapsed < limitMs) {
      return { allowed: false, retryAfterMs: limitMs - elapsed };
    }

    const windowMs = Math.max(entry?.windowMs ?? 0, limitMs);
    perUser.set(userId, { last: now, windowMs });
    return { allowed: true };
  }

  check(interaction: Interaction, limitMs: number, key?: string): { allowed: boolean; retryAfterMs?: number; commandKey: string } {
    const { userId, commandKey } = this.resolveInteractionKeyAndUser(interaction, key);
    const { allowed, retryAfterMs } = this.tryConsume(commandKey, userId, limitMs);
    return { allowed, retryAfterMs, commandKey };
  }

  private resolveInteractionKeyAndUser(interaction: Interaction, key?: string): { userId: string; commandKey: string } {
    const anyIx: any = interaction as any;
    const userId = anyIx.user?.id || anyIx.member?.user?.id || 'unknown';

    if (key) return { userId, commandKey: key };

    if (anyIx.isChatInputCommand?.() && anyIx.commandName) {
      return { userId, commandKey: anyIx.commandName as string };
    }
    const customId: string | undefined = anyIx.customId as string | undefined;
    const inferred = customId ? String(customId).split(':')[0] : 'unknown';
    return { userId, commandKey: inferred };
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [commandKey, perUser] of this.usageMap) {
      for (const [userId, entry] of perUser) {
        if (now - entry.last > entry.windowMs) {
          perUser.delete(userId);
          removed++;
        }
      }
      if (perUser.size === 0) {
        this.usageMap.delete(commandKey);
      }
    }
    if (removed > 0) {
      logger.debug(`CommandRateLimiter cleanup removed ${removed} entries`);
    }
  }
}
