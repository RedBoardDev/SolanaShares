import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import { logger } from '@helpers/logger';
import { setupErrorHandler } from '@helpers/error-handler';
import { config } from '@infrastructure/config/env';
import { CacheInitializerService } from '@infrastructure/services/cache-initializer.service';
import { WalletSchedulerService } from '@infrastructure/services/wallet-scheduler.service';
import { OnChainSchedulerService } from '@infrastructure/services/onchain-scheduler.service';
import { InteractionRouter } from '@presentation/listeners/interactions/interaction-router';
import { linkWalletCommand } from '@presentation/commands/link-wallet.command';
import { depositCommand } from '@presentation/commands/deposit.command';
import { walletCommand } from '@presentation/commands/wallet.command';
import { participantsCommand } from '@presentation/commands/participants.command';
import { syncCommand } from '@presentation/commands/force-sync.command';

const DISCORD_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];

async function registerSlashCommands(clientId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  const payload = [
    linkWalletCommand.data.toJSON(),
    depositCommand.data.toJSON(),
    walletCommand.data.toJSON(),
    participantsCommand.data.toJSON(),
    syncCommand.data.toJSON(),
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
          case linkWalletCommand.data.name:
            await linkWalletCommand.execute(interaction);
            break;
          case depositCommand.data.name:
            await depositCommand.execute(interaction);
            break;
          case walletCommand.data.name:
            await walletCommand.execute(interaction);
            break;
          case participantsCommand.data.name:
            await participantsCommand.execute(interaction);
            break;
          case 'force-sync':
            await syncCommand.execute(interaction);
            break;
          default:
            await interaction.reply({
              content: 'Unknown command',
              flags: MessageFlags.Ephemeral,
            });
        }
      } else {
        // Router les autres interactions (boutons, dropdowns, modals)
        await interactionRouter.routeInteraction(interaction);
      }
    } catch (error) {
      logger.error('Error in interaction handler', error as Error);
    }
  });
}

function wireAdditionalListeners(_client: Client) {}

function setupShutdownHooks(client: Client) {
  const shutdown = async () => {
    logger.info('Graceful shutdown initiated');
    try {
      const walletScheduler = WalletSchedulerService.getInstance();
      walletScheduler.stopScheduler();
      logger.info('Wallet scheduler stopped');

      const onchainScheduler = OnChainSchedulerService.getInstance();
      onchainScheduler.stopScheduler();
      logger.info('On-chain scheduler stopped');

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

  logger.info('Starting wallet scheduler');
  const walletScheduler = WalletSchedulerService.getInstance();
  walletScheduler.startScheduler();

  const onchainScheduler = OnChainSchedulerService.getInstance();
  onchainScheduler.startScheduler();

  const client = new Client({ intents: DISCORD_INTENTS });

  client.once('ready', async () => {
  const app = await client.application?.fetch();
  const clientId = app?.id ?? client.user?.id;
  if (!clientId) {
    logger.error('Unable to resolve application clientId for slash registration');
    return;
  }

  await registerSlashCommands(clientId, config.discordToken);
  logger.info('Slash commands registered');
});

  wireInteractionHandler(client);
  wireAdditionalListeners(client);
  client.on('error', (error) => { logger.error('Discord client error', error); });
  setupShutdownHooks(client);
  await client.login(config.discordToken);
}

main().catch((err: unknown) => {
  logger.fatal('Bot startup failed', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
