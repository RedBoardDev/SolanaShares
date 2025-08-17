import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

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

const DISCORD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

async function registerSlashCommands(clientId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  const payload = [
    startCommand.data.toJSON(),
    followedChannelsCommand.data.toJSON(),
    serverSettingsCommand.data.toJSON(),
    nftPriceCommand.data.toJSON(),
    positionSizeCommand.data.toJSON(),
    globalPositionsCommand.data.toJSON(),
    helpCommand.data.toJSON(),
    donateCommand.data.toJSON(),
  ];

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: payload });
    logger.info('✅ Registered slash commands');
  } catch (err: unknown) {
    logger.error('Failed to register slash commands', err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

function wireInteractionHandler(client: Client) {
  const interactionRouter = InteractionRouter.getInstance();

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
          case startCommand.data.name:
            await startCommand.execute(interaction);
            break;
          case followedChannelsCommand.data.name:
            await followedChannelsCommand.execute(interaction);
            break;
          case serverSettingsCommand.data.name:
            await serverSettingsCommand.execute(interaction);
            break;
          case nftPriceCommand.data.name:
            await nftPriceCommand.execute(interaction);
            break;
          case positionSizeCommand.data.name:
            await positionSizeCommand.execute(interaction);
            break;
          case globalPositionsCommand.data.name:
            await globalPositionsCommand.execute(interaction);
            break;
          case helpCommand.data.name:
            await helpCommand.execute(interaction);
            break;
          case donateCommand.data.name:
            await donateCommand.execute(interaction);
            break;
          default:
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

  const client = new Client({ intents: DISCORD_INTENTS });

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    await registerSlashCommands(client.user!.id, config.discordToken);

    PositionDisplayScheduler.getInstance().start(client);
  });

  wireInteractionHandler(client);
  registerMessageDispatcherListener(client);

  client.on('error', (error) => {
    logger.error('Discord client error', error);
  });

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
