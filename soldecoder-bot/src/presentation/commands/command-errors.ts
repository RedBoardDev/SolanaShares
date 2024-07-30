import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';

export class CommandError extends Error {
  readonly code: string;
  readonly safeMessage: string;

  constructor(message: string, code = 'COMMAND_ERROR') {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.safeMessage = message;
  }
}

export class NotInGuildError extends CommandError {
  constructor(message = '❌ This command can only be used in a server.') {
    super(message, 'NOT_IN_GUILD');
  }
}

export class InvalidCommandUsageError extends CommandError {
  constructor(message = '❌ Invalid command usage.') {
    super(message, 'INVALID_COMMAND_USAGE');
  }
}

export class MissingConfigurationError extends CommandError {
  constructor(message = 'ℹ️ Missing required configuration. Please configure server defaults first.') {
    super(message, 'MISSING_CONFIGURATION');
  }
}

export class PermissionDeniedError extends CommandError {
  constructor(message = '❌ You do not have permission to run this command.') {
    super(message, 'PERMISSION_DENIED');
  }
}

export class RateLimitedError extends CommandError {
  constructor(message = '⏳ You are doing that too often. Please try again later.') {
    super(message, 'RATE_LIMITED');
  }
}

export class ExternalServiceError extends CommandError {
  constructor(message = '❌ A required external service is unavailable. Please try again later.') {
    super(message, 'EXTERNAL_SERVICE_ERROR');
  }
}

export function getUserMessageForError(error: unknown, fallbackMessage = '❌ An unexpected error occurred. Please try again later.'): string {
  // Presentation-specific typed errors with predefined safe messages
  if (error instanceof CommandError) return error.safeMessage;

  // Common validation libraries (best-effort, without importing heavy deps)
  const maybeZod = error as { name?: string; issues?: unknown[]; message?: string } | undefined;
  if (maybeZod && maybeZod.name === 'ZodError') {
    return '❌ Invalid input. Please check your parameters and try again.';
  }

  // Generic Error: do NOT leak internals; prefer fallback
  if (error instanceof Error) {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export async function respondWithCommandError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
  fallbackMessage = '❌ An unexpected error occurred. Please try again later.'
): Promise<void> {
  const message = getUserMessageForError(error, fallbackMessage);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: message });
  } else {
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  }
}
