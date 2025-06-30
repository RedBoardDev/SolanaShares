import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import { container } from '../../infra/DependencyContainer';
import { CreateWalletUseCase } from '../../application/use-cases/CreateWalletUseCase';
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
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
      return;
    }

    // Send wallet info via DM
    try {
      await interaction.user.send({
        content: `🎉 **Your Solana wallet has been created!**\n\n` +
                `**Wallet Address:** \`${result.walletAddress}\`\n\n` +
                `**⚠️ IMPORTANT - Your Seed Phrase:**\n` +
                `\`\`\`\n${result.mnemonic}\n\`\`\`\n\n` +
                `**⚠️ Keep this seed phrase safe and never share it with anyone!**\n` +
                `You will need it to recover your wallet if needed.`,
      });

      await interaction.editReply({
        content: '✅ Wallet created successfully! Check your DMs for your wallet details.',
      });
    } catch (error) {
      await interaction.editReply({
        content: `✅ Wallet created successfully!\n\n` +
                `**Address:** \`${result.walletAddress}\`\n\n` +
                `⚠️ I couldn't send you a DM. Please save this information securely:\n` +
                `**Seed phrase:** ||${result.mnemonic}||`,
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