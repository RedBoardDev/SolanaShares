import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { CommandRateLimiterService } from '@infrastructure/services/command-rate-limiter.service';
import { logger } from '@helpers/logger';
import { NotInGuildError, RateLimitedError, respondWithCommandError } from '@presentation/commands/command-errors';

export type RunCommandOptions = {
  interaction: ChatInputCommandInteraction;
  rateLimitMs: number;
  rateLimitKey?: string;
  requireGuild?: boolean;
  ephemeral?: boolean;
  fallbackMessage?: string;
  logLabel?: string;
  execute: () => Promise<void>;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0 && seconds > 0) return `${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  const {
    interaction,
    rateLimitMs,
    rateLimitKey,
    requireGuild = true,
    ephemeral = true,
    fallbackMessage = '❌ An unexpected error occurred. Please try again later.',
    logLabel = 'Command execution error',
    execute,
  } = options;

  try {
    const limiter = CommandRateLimiterService.getInstance();
    const commandKey = rateLimitKey ?? interaction.commandName ?? 'unknown';
    const userId = interaction.user?.id ?? 'unknown';
    const { allowed, retryAfterMs } = limiter.tryConsume(commandKey, userId, rateLimitMs);
    if (!allowed) {
      throw new RateLimitedError(`⏳ Please wait ${formatDuration(retryAfterMs || 0)} before using this again.`);
    }

    if (requireGuild && !interaction.guildId) {
      throw new NotInGuildError();
    }

    const anyIx: any = interaction as any;
    if (!anyIx.deferred && !anyIx.replied) {
      await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }

    await execute();
  } catch (error) {
    logger.error(logLabel, error as Error, { guildId: options.interaction.guildId });
    await respondWithCommandError(options.interaction, error, fallbackMessage);
  }
}
