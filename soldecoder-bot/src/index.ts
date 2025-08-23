import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { logger } from '@helpers/logger';
import { registerMessageDispatcherListener } from '@presentation/listeners/message-create/message-dispatcher.listener';
import { setupErrorHandler } from '@helpers/error-handler';
import { config } from '@infrastructure/config/env';
import { CacheInitializerService } from '@infrastructure/services/cache-initializer.service';
import { followedChannelsCommand } from '@presentation/commands/channels.command';
import { serverSettingsCommand } from '@presentation/commands/server-settings.command';
import { nftPriceCommand } from '@presentation/commands/nft-price.command';
import { positionSizeCommand } from '@presentation/commands/position-size.command';
import { globalPositionsCommand } from '@presentation/commands/global-positions.command';
import { startCommand } from '@presentation/commands/start.command';
import { helpCommand } from '@presentation/commands/help.command';
import { donateCommand } from '@presentation/commands/donate.command';
import { InteractionRouter } from '@presentation/listeners/interactions/interaction-router';
import { PositionDisplayScheduler } from '@infrastructure/services/position-display-scheduler.service';
import { CommandManagerService } from '@infrastructure/services/command-manager.service';

const DISCORD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

function setupCommands(): CommandManagerService {
  const commandManager = CommandManagerService.getInstance();

  // Register all commands with the manager
  commandManager.registerCommand(helpCommand);
  commandManager.registerCommand(nftPriceCommand);
  commandManager.registerCommand(startCommand);
  commandManager.registerCommand(followedChannelsCommand);
  commandManager.registerCommand(serverSettingsCommand);
  commandManager.registerCommand(positionSizeCommand);
  commandManager.registerCommand(globalPositionsCommand);
  commandManager.registerCommand(donateCommand);

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
      PositionDisplayScheduler.getInstance().stop();

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

    PositionDisplayScheduler.getInstance().start(client);

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
  registerMessageDispatcherListener(client);

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
