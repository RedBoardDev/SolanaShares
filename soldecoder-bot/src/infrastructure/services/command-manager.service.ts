import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import type { Client, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createHash } from 'node:crypto';
import { logger } from '@helpers/logger';
import { config } from '@infrastructure/config/env';

export interface CommandDefinition {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

interface StoredCommand {
  id: string;
  name: string;
  hash: string;
  description: string;
}

interface CommandComparison {
  toAdd: CommandDefinition[];
  toUpdate: Array<{ command: CommandDefinition; existingId: string }>;
  toDelete: string[]; // IDs of commands to delete
  unchanged: string[]; // Names of unchanged commands
}

interface SyncResults {
  deleted: number;
  deleteErrors: number;
  updated: number;
  updateErrors: number;
  added: number;
  addErrors: number;
}

interface SyncOperation {
  type: 'delete' | 'update' | 'add';
  name: string;
  id?: string;
}

export class CommandManagerService {
  private static instance: CommandManagerService;
  private rest: REST;
  private commands: Map<string, CommandDefinition> = new Map();

  private constructor() {
    this.rest = new REST({ version: '10' }).setToken(config.discordToken);
  }

  public static getInstance(): CommandManagerService {
    if (!CommandManagerService.instance) {
      CommandManagerService.instance = new CommandManagerService();
    }
    return CommandManagerService.instance;
  }

  /**
   * Register a command definition
   */
  public registerCommand(command: CommandDefinition): void {
    this.commands.set(command.data.name, command);
  }

  /**
   * Helper function to handle sync operation errors consistently
   */
  private handleSyncError(operation: SyncOperation, error: unknown, results: SyncResults): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorKey = `${operation.type}Errors` as keyof SyncResults;

    (results as any)[errorKey]++;
    logger.error(`❌ Failed to ${operation.type} command ${operation.name}:`, error instanceof Error ? error : new Error(errorMessage));

    throw new Error(`Critical error: Failed to ${operation.type} command ${operation.name}. Aborting sync.`);
  }

  /**
   * Helper function to wait between Discord API operations
   */
  private async waitForDiscordProcessing(milliseconds: number = 1000): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Helper function to initialize sync results
   */
  private createSyncResults(): SyncResults {
    return {
      deleted: 0,
      deleteErrors: 0,
      updated: 0,
      updateErrors: 0,
      added: 0,
      addErrors: 0
    };
  }

  /**
   * Calculate hash for a command to detect changes
   * Creates a deterministic hash that's stable across identical commands
   */
  private calculateCommandHash(commandData: any): string {
    // Normalize the command data to ensure consistent hashing
    const normalizedData = {
      name: commandData.name || '',
      description: commandData.description || '',
      // Sort options by name to ensure consistent order
      options: (commandData.options || []).map((opt: any) => ({
        name: opt.name || '',
        description: opt.description || '',
        type: opt.type || 0,
        required: opt.required || false,
        choices: opt.choices || [],
        options: opt.options || []
      })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      default_member_permissions: commandData.default_member_permissions || null,
      dm_permission: commandData.dm_permission !== false, // default true
      nsfw: commandData.nsfw || false
    };

    // Create deterministic JSON string (sorted keys)
    const commandString = JSON.stringify(normalizedData, Object.keys(normalizedData).sort());

    return createHash('sha256').update(commandString).digest('hex').substring(0, 16);
  }

  /**
   * Get all existing commands from Discord
   */
  private async getExistingCommands(clientId: string): Promise<StoredCommand[]> {
    try {
      const existingCommands = await this.rest.get(Routes.applicationCommands(clientId)) as any[];

      return existingCommands.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        hash: this.calculateCommandHash(cmd),
        description: cmd.description
      }));
    } catch (error) {
      logger.error('Failed to fetch existing commands', error as Error);
      throw error;
    }
  }

  /**
   * Compare current commands with existing ones to determine what needs to be changed
   */
  private compareCommands(existing: StoredCommand[]): CommandComparison {
    const result: CommandComparison = {
      toAdd: [],
      toUpdate: [],
      toDelete: [],
      unchanged: []
    };

    // Create maps for easier comparison
    const existingMap = new Map(existing.map(cmd => [cmd.name, cmd]));
    const currentCommands = Array.from(this.commands.values());

    // Check each current command
    for (const command of currentCommands) {
      const commandName = command.data.name;
      const commandData = command.data.toJSON();
      const currentHash = this.calculateCommandHash(commandData);

      const existingCommand = existingMap.get(commandName);

      if (!existingCommand) {
        // Command doesn't exist, need to add
        result.toAdd.push(command);
      } else if (existingCommand.hash !== currentHash) {
        // Command exists but changed, need to update
        result.toUpdate.push({
          command,
          existingId: existingCommand.id
        });
      } else {
        // Command unchanged
        result.unchanged.push(commandName);
      }
    }

    // Find commands to delete (exist on Discord but not in our current set)
    const currentCommandNames = new Set(this.commands.keys());
    for (const existingCommand of existing) {
      if (!currentCommandNames.has(existingCommand.name)) {
        result.toDelete.push(existingCommand.id);
      }
    }

    return result;
  }

  /**
   * Delete obsolete commands from Discord
   */
  private async deleteCommands(clientId: string, commandIds: string[], results: SyncResults): Promise<void> {
    if (commandIds.length === 0) return;

    logger.info('🗑️ Phase 1: Deleting obsolete commands...');

    for (const commandId of commandIds) {
      try {
        await this.rest.delete(Routes.applicationCommand(clientId, commandId));
        results.deleted++;
        logger.info(`✅ Deleted obsolete command ID: ${commandId}`);
      } catch (error) {
        this.handleSyncError({ type: 'delete', name: commandId }, error, results);
      }
    }

    await this.waitForDiscordProcessing();
  }

  /**
   * Update existing commands on Discord
   */
  private async updateCommands(clientId: string, updates: Array<{ command: CommandDefinition; existingId: string }>, results: SyncResults): Promise<void> {
    if (updates.length === 0) return;

    logger.info('📝 Phase 2: Updating changed commands...');

    for (const { command, existingId } of updates) {
      try {
        const commandData = command.data.toJSON();
        await this.rest.patch(Routes.applicationCommand(clientId, existingId), {
          body: commandData
        });
        results.updated++;
        logger.info(`✅ Updated command: ${command.data.name} (ID: ${existingId})`);
      } catch (error) {
        this.handleSyncError({ type: 'update', name: command.data.name, id: existingId }, error, results);
      }
    }

    await this.waitForDiscordProcessing();
  }

  /**
   * Add new commands to Discord
   */
  private async addCommands(clientId: string, commands: CommandDefinition[], results: SyncResults): Promise<void> {
    if (commands.length === 0) return;

    logger.info('➕ Phase 3: Adding new commands...');

    for (const command of commands) {
      try {
        const commandData = command.data.toJSON();
        const result = await this.rest.post(Routes.applicationCommands(clientId), {
          body: commandData
        });
        results.added++;
        logger.info(`✅ Added new command: ${command.data.name} (ID: ${(result as any).id})`);
      } catch (error) {
        this.handleSyncError({ type: 'add', name: command.data.name }, error, results);
      }
    }
  }

  /**
   * Apply command changes to Discord with detailed validation
   */
  private async applyChanges(clientId: string, changes: CommandComparison): Promise<void> {
    const { toAdd, toUpdate, toDelete, unchanged } = changes;

    logger.info(`📊 Command sync analysis:`, {
      toAdd: toAdd.length,
      toUpdate: toUpdate.length,
      toDelete: toDelete.length,
      unchanged: unchanged.length
    });

    const results = this.createSyncResults();

    // Execute sync phases in order
    await this.deleteCommands(clientId, toDelete, results);
    await this.updateCommands(clientId, toUpdate, results);
    await this.addCommands(clientId, toAdd, results);

    // Log final results
    this.logSyncResults(results, unchanged);

    // Verify no errors occurred
    this.validateSyncResults(results);
  }

  /**
   * Log sync operation results
   */
  private logSyncResults(results: SyncResults, unchanged: string[]): void {
    logger.info('📊 Sync operation completed:', {
      deleted: results.deleted,
      updated: results.updated,
      added: results.added,
      unchanged: unchanged.length,
      totalErrors: results.deleteErrors + results.updateErrors + results.addErrors
    });

    if (unchanged.length > 0) {
      logger.info(`✅ Unchanged commands: ${unchanged.join(', ')}`);
    }
  }

  /**
   * Validate sync results and throw if errors occurred
   */
  private validateSyncResults(results: SyncResults): void {
    const totalErrors = results.deleteErrors + results.updateErrors + results.addErrors;
    if (totalErrors > 0) {
      throw new Error(`Command sync failed with ${totalErrors} errors. Check logs for details.`);
    }
  }

  /**
   * Smart sync that only updates what's necessary
   */
  public async syncCommands(client: Client): Promise<void> {
    try {
      const clientId = await this.getClientId(client);

      logger.info('🔄 Starting smart command synchronization...');

      // Validate we have commands to sync
      if (this.commands.size === 0) {
        logger.warn('⚠️ No commands registered for synchronization');
        return;
      }

      // Get existing commands from Discord
      const existingCommands = await this.getExistingCommands(clientId);
      logger.info(`📋 Found ${existingCommands.length} existing commands on Discord`);

      // Compare and determine changes needed
      const changes = this.compareCommands(existingCommands);

      // Check if any changes are needed
      const hasChanges = changes.toAdd.length > 0 || changes.toUpdate.length > 0 || changes.toDelete.length > 0;

      if (!hasChanges) {
        logger.info('✅ All commands are up to date, no changes needed');
        return;
      }

      // Apply changes
      await this.applyChanges(clientId, changes);

      // Final validation: verify the sync was successful
      logger.info('🔍 Verifying synchronization...');
      await this.validateSyncResult(clientId);

      logger.info('✅ Smart command synchronization completed successfully');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to sync commands', new Error(errorMsg));
      throw error;
    }
  }

  /**
   * Validate command counts match between Discord and local
   */
  private validateCommandCounts(discordCommands: StoredCommand[], localCommands: CommandDefinition[]): void {
    if (discordCommands.length !== localCommands.length) {
      throw new Error(`Command count mismatch: Discord has ${discordCommands.length}, local has ${localCommands.length}`);
    }
  }

  /**
   * Validate that each local command exists on Discord with correct hash
   */
  private validateLocalCommandsOnDiscord(discordCommands: StoredCommand[], localCommands: CommandDefinition[]): void {
    for (const localCommand of localCommands) {
      const commandName = localCommand.data.name;
      const localHash = this.calculateCommandHash(localCommand.data.toJSON());

      const discordCommand = discordCommands.find(cmd => cmd.name === commandName);

      if (!discordCommand) {
        throw new Error(`Command "${commandName}" not found on Discord after sync`);
      }

      if (discordCommand.hash !== localHash) {
        throw new Error(`Command "${commandName}" hash mismatch after sync. Expected: ${localHash}, Got: ${discordCommand.hash}`);
      }
    }
  }

  /**
   * Validate that no extra commands exist on Discord
   */
  private validateNoExtraDiscordCommands(discordCommands: StoredCommand[]): void {
    for (const discordCommand of discordCommands) {
      const localCommand = this.commands.get(discordCommand.name);
      if (!localCommand) {
        throw new Error(`Extra command "${discordCommand.name}" found on Discord after sync`);
      }
    }
  }

  /**
   * Validate that Discord commands match our local commands after sync
   */
  private async validateSyncResult(clientId: string): Promise<void> {
    try {
      const discordCommands = await this.getExistingCommands(clientId);
      const localCommands = Array.from(this.commands.values());

      // Run all validation checks
      this.validateCommandCounts(discordCommands, localCommands);
      this.validateLocalCommandsOnDiscord(discordCommands, localCommands);
      this.validateNoExtraDiscordCommands(discordCommands);

      logger.info(`✅ Validation successful: ${discordCommands.length} commands perfectly synchronized`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Sync validation failed', new Error(errorMsg));
      throw error;
    }
  }

  /**
   * Get client ID with proper error handling
   */
  private async getClientId(client: Client): Promise<string> {
    const app = await client.application?.fetch();
    const clientId = app?.id ?? client.user?.id;

    if (!clientId) {
      throw new Error('Unable to resolve application clientId');
    }

    return clientId;
  }

  /**
   * Force re-register all commands (fallback method)
   */
  public async forceRegisterAll(client: Client): Promise<void> {
    try {
      const clientId = await this.getClientId(client);

      logger.info('🔄 Force registering all commands...');

      const commands = Array.from(this.commands.values());
      if (commands.length === 0) {
        logger.warn('⚠️ No commands to register');
        return;
      }

      const payload = commands.map(cmd => cmd.data.toJSON());

      await this.rest.put(Routes.applicationCommands(clientId), { body: payload });

      logger.info(`✅ Force registered ${payload.length} commands successfully`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to force register commands', new Error(errorMsg));
      throw error;
    }
  }

  /**
   * Get registered commands for interaction handling
   */
  public getCommand(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all registered command names
   */
  public getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Clear all registered commands (useful for testing)
   */
  public clearCommands(): void {
    this.commands.clear();
  }
}
