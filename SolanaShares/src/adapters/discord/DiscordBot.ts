import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import { container } from '../../infra/DependencyContainer';
import { CreateWalletUseCase } from '../../application/use-cases/CreateWalletUseCase';
import { ExportWalletUseCase } from '../../application/use-cases/ExportWalletUseCase';
import { LoggerService } from '../../domain/ports/services';
import { env } from '../../config/environment';

export class DiscordBot {
  private client: Client;
  private logger: LoggerService;

  constructor() {
    this.logger = container.resolve<LoggerService>('LoggerService');
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
      ],
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      this.logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        this.logger.error('Error handling Discord command', error as Error, {
          commandName: interaction.commandName,
          userId: interaction.user.id,
        });

        const reply = {
          content: '❌ An error occurred while processing your command.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commandName, user } = interaction;

    switch (commandName) {
      case 'start':
        await this.handleStartCommand(interaction);
        break;
      case 'export':
        await this.handleExportCommand(interaction);
        break;
      case 'wallet':
        await this.handleWalletCommand(interaction);
        break;
      case 'stats':
        await this.handleStatsCommand(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown command.',
          ephemeral: true,
        });
    }
  }

  private async handleStartCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const createWalletUseCase = container.resolve<CreateWalletUseCase>('CreateWalletUseCase');
    const result = await createWalletUseCase.execute({
      userId: interaction.user.id,
      username: interaction.user.username,
    });

    if (!result.success) {
      if (result.error?.includes('already has a wallet')) {
        await interaction.editReply({
          content: '⚠️ You already have a wallet! Use `/export` to get your private key.',
        });
      } else {
        await interaction.editReply({
          content: `❌ ${result.error}`,
        });
      }
      return;
    }

    // Send wallet info via DM
    try {
      await interaction.user.send({
        content: `🎉 **Your Solana wallet has been created!**\n\n` +
                `**Wallet Address:** \`${result.walletAddress}\`\n\n` +
                `**⚠️ IMPORTANT - Your Private Key (Base64):**\n` +
                `\`\`\`\n${result.privateKey}\n\`\`\`\n\n` +
                `**⚠️ Keep this private key safe and never share it with anyone!**\n` +
                `You can import this wallet in Phantom or any Solana wallet app.\n\n` +
                `To convert to array format for Phantom import:\n` +
                `1. Decode the base64 string\n` +
                `2. Convert to byte array\n\n` +
                `Use \`/export\` command anytime to retrieve your private key again.`,
      });

      await interaction.editReply({
        content: '✅ Wallet created successfully! Check your DMs for your wallet details.',
      });
    } catch (error) {
      await interaction.editReply({
        content: `✅ Wallet created successfully!\n\n` +
                `**Address:** \`${result.walletAddress}\`\n\n` +
                `⚠️ I couldn't send you a DM. Please enable DMs from server members and use \`/export\` to get your private key.`,
      });
    }
  }

  private async handleExportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const exportWalletUseCase = container.resolve<ExportWalletUseCase>('ExportWalletUseCase');
    const result = await exportWalletUseCase.execute({
      userId: interaction.user.id,
    });

    if (!result.success) {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
      return;
    }

    // Send wallet info via DM
    try {
      await interaction.user.send({
        content: `🔐 **Your Solana Wallet Details**\n\n` +
                `**Wallet Address:** \`${result.walletAddress}\`\n\n` +
                `**Private Key (Base64):**\n` +
                `\`\`\`\n${result.privateKey}\n\`\`\`\n\n` +
                `**⚠️ Keep this private key safe and never share it with anyone!**\n` +
                `You can import this wallet in Phantom or any Solana wallet app.`,
      });

      await interaction.editReply({
        content: '✅ Check your DMs for your wallet details.',
      });
    } catch (error) {
      await interaction.editReply({
        content: `⚠️ I couldn't send you a DM. Please enable DMs from server members.\n\n` +
                `**Wallet Address:** \`${result.walletAddress}\`\n\n` +
                `For security reasons, I cannot display your private key in public channels. ` +
                `Please enable DMs and try again.`,
      });
    }
  }

  private async handleWalletCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content: '🏦 Wallet information - This feature is not implemented yet.',
      ephemeral: true,
    });
  }

  private async handleStatsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content: '📊 Statistics - This feature is not implemented yet.',
      ephemeral: true,
    });
  }

  async registerCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('start')
        .setDescription('Create your personal trading wallet'),
      
      new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export your wallet private key'),
      
      new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('View your wallet information'),
      
      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View trading pool statistics'),
    ].map(command => command.toJSON());

    const rest = new REST().setToken(env.DISCORD_TOKEN);

    try {
      this.logger.info('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(env.DISCORD_CLIENT_ID),
        { body: commands }
      );

      this.logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      this.logger.error('Failed to register Discord commands', error as Error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.registerCommands();
      await this.client.login(env.DISCORD_TOKEN);
    } catch (error) {
      this.logger.error('Failed to start Discord bot', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.logger.info('Discord bot stopped');
  }
}