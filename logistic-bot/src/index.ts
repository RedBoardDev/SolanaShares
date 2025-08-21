import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { logger } from '@helpers/logger';
import { setupErrorHandler } from '@helpers/error-handler';
import { config } from '@infrastructure/config/env';
import { CacheInitializerService } from '@infrastructure/services/cache-initializer.service';
import { WalletSchedulerService } from '@infrastructure/services/wallet-scheduler.service';
import { OnChainSchedulerService } from '@infrastructure/services/onchain-scheduler.service';
import { CommandManagerService } from '@infrastructure/services/command-manager.service';
import { InteractionRouter } from '@presentation/listeners/interactions/interaction-router';
import { linkWalletCommand } from '@presentation/commands/link-wallet.command';
import { depositCommand } from '@presentation/commands/deposit.command';
import { walletCommand } from '@presentation/commands/wallet.command';
import { participantsCommand } from '@presentation/commands/participants.command';
import { syncCommand } from '@presentation/commands/force-sync.command';

const DISCORD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

function setupCommands(): CommandManagerService {
  const commandManager = CommandManagerService.getInstance();

  // Register all commands with the manager
  commandManager.registerCommand(linkWalletCommand);
  commandManager.registerCommand(depositCommand);
  commandManager.registerCommand(walletCommand);
  commandManager.registerCommand(participantsCommand);
  commandManager.registerCommand(syncCommand);

  return commandManager;
}

function wireInteractionHandler(client: Client, commandManager: CommandManagerService) {
  const interactionRouter = InteractionRouter.getInstance();

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandManager.getCommand(interaction.commandName);

        if (command) {
          await command.execute(interaction);
        } else {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          await interaction.reply({
            content: 'Unknown command',
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        await interactionRouter.routeInteraction(interaction);
      }
    } catch (error) {
      logger.error('Error in interaction handler', error as Error);
    }
  });
}

function setupShutdownHooks(client: Client) {
  const shutdown = async () => {
    logger.info('Graceful shutdown initiated');
    try {
      WalletSchedulerService.getInstance().stopScheduler();
      OnChainSchedulerService.getInstance().stopScheduler();

      await client.destroy();
      logger.info('Discord client destroyed');
    } catch (err: unknown) {
      logger.error('Error during shutdown', err instanceof Error ? err : new Error(String(err)));
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  logger.info('Initializing bot');
  setupErrorHandler();

  const cacheInitializer = new CacheInitializerService();
  await cacheInitializer.initializeCache();

  const commandManager = setupCommands();

  const client = new Client({ intents: DISCORD_INTENTS });

  client.once('ready', async () => {
    logger.info(`🤖 Bot logged in as ${client.user?.tag}`);

    WalletSchedulerService.getInstance().startScheduler();
    OnChainSchedulerService.getInstance().startScheduler();

    try {
      // Smart command synchronization - only updates what's changed
      await commandManager.syncCommands(client);
      logger.info('✅ Commands synchronized successfully');
    } catch (error) {
      logger.error('❌ Failed to synchronize commands', error as Error);

      // Fallback: force register all commands
      try {
        logger.info('🔄 Attempting fallback: force register all commands...');
        await commandManager.forceRegisterAll(client);
        logger.info('✅ Fallback command registration successful');
      } catch (fallbackError) {
        logger.error('❌ Fallback command registration also failed', fallbackError as Error);
        process.exit(1);
      }
    }
  });

  wireInteractionHandler(client, commandManager);

  client.on('error', (error) => { logger.error('Discord client error', error); });

  setupShutdownHooks(client);

  try {
    await client.login(config.discordToken);
  } catch (err: unknown) {
    logger.fatal('Failed to login to Discord', err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  logger.fatal('Bot startup failed', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
