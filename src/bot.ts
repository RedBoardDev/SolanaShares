import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import { PNLCalculator } from './pnl-calculator';
import { SolanaTracker } from './solana-tracker';
import { db } from './database';

export class PNLBot {
  private client: Client;
  private pnlCalculator: PNLCalculator;
  private solanaTracker: SolanaTracker;
  private token: string;
  private clientId: string;

  constructor(
    token: string, 
    clientId: string, 
    rpcUrl: string,
    hotWalletAddress: string,
    monthlyPoolCost: number = 40
  ) {
    this.token = token;
    this.clientId = clientId;
    this.solanaTracker = new SolanaTracker(rpcUrl, hotWalletAddress);
    this.pnlCalculator = new PNLCalculator(this.solanaTracker, monthlyPoolCost);
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      console.log(`✅ Bot connecté en tant que ${this.client.user?.tag}`);
      // Synchroniser les dépôts au démarrage
      this.solanaTracker.syncDeposits().catch(console.error);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        console.error('Erreur lors du traitement de la commande:', error);
        
        const reply = {
          content: '❌ Une erreur s\'est produite lors du traitement de votre commande.',
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
    switch (interaction.commandName) {
      case 'pnl':
        await this.handlePNLCommand(interaction);
        break;
      case 'wallet':
        await this.handleWalletCommand(interaction);
        break;
      case 'pool':
        await this.handlePoolCommand(interaction);
        break;
      case 'sync':
        await this.handleSyncCommand(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Commande inconnue.',
          ephemeral: true,
        });
    }
  }

  private async handlePNLCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    
    // Vérifier si l'utilisateur a un wallet associé
    const userWallet = await db.getUserWallet(userId);
    if (!userWallet) {
      await interaction.editReply({
        content: '❌ Vous devez d\'abord associer votre wallet Solana avec `/wallet <address>`.',
      });
      return;
    }

    const pnl = await this.pnlCalculator.calculateUserPNL(userId);

    if (!pnl) {
      await interaction.editReply({
        content: '❌ Aucun investissement trouvé. Vos dépôts seront détectés automatiquement après synchronisation.',
      });
      return;
    }

    const display = this.pnlCalculator.formatPNLForDisplay(pnl);
    await interaction.editReply({
      content: display,
    });
  }

  private async handleWalletCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const address = interaction.options.getString('address', true);
    
    // Valider l'adresse Solana
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      await interaction.reply({
        content: '❌ Adresse Solana invalide.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Vérifier si l'adresse est déjà utilisée
    const existingUser = await db.getUserByWallet(address);
    if (existingUser && existingUser.userId !== interaction.user.id) {
      await interaction.editReply({
        content: '❌ Cette adresse est déjà associée à un autre utilisateur.',
      });
      return;
    }

    // Enregistrer ou mettre à jour l'association
    await db.addUserWallet(
      interaction.user.id,
      interaction.user.username,
      address
    );

    await interaction.editReply({
      content: `✅ Votre wallet a été associé avec succès!\n\n` +
               `**Adresse:** \`${address}\`\n\n` +
               `📌 **Important:** Envoyez vos dépôts depuis cette adresse vers le hot wallet pour qu'ils soient comptabilisés.\n` +
               `Les dépôts sont synchronisés automatiquement toutes les heures.`,
    });
  }

  private async handlePoolCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const stats = await this.pnlCalculator.getPoolStats();
    const sign = stats.totalPNL_USD >= 0 ? '+' : '';

    const content = `📊 **État du Pool de Trading**\n\n` +
                    `👥 Nombre d'investisseurs: **${stats.investorsCount}**\n` +
                    `💰 Total investi: **${stats.totalInvestedSOL.toFixed(4)} SOL** (~$${stats.totalInvestedUSD.toFixed(2)})\n` +
                    `💎 Valeur actuelle: **${stats.currentValueSOL.toFixed(4)} SOL** (~$${stats.currentValueUSD.toFixed(2)})\n` +
                    `📈 PNL Global: **${sign}$${stats.totalPNL_USD.toFixed(2)} (${sign}${stats.pnlPercentage.toFixed(2)}%)**\n\n` +
                    `_Dernière synchronisation: ${new Date().toLocaleString()}_`;

    await interaction.editReply({ content });
  }

  private async handleSyncCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Vérifier si l'utilisateur est admin
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ Seuls les administrateurs peuvent forcer la synchronisation.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await this.solanaTracker.syncDeposits();
      await interaction.editReply({
        content: '✅ Synchronisation des dépôts terminée!',
      });
    } catch (error) {
      await interaction.editReply({
        content: '❌ Erreur lors de la synchronisation.',
      });
    }
  }

  async registerCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('pnl')
        .setDescription('Affiche votre PNL personnel avec prise en compte des frais'),
      
      new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Associe votre wallet Solana à votre compte Discord')
        .addStringOption(option =>
          option.setName('address')
            .setDescription('Votre adresse Solana')
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName('pool')
        .setDescription('Affiche les statistiques globales du pool'),
      
      new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Force la synchronisation des dépôts (Admin uniquement)'),
    ].map(command => command.toJSON());

    const rest = new REST().setToken(this.token);

    try {
      console.log('🔄 Enregistrement des commandes Discord...');

      await rest.put(
        Routes.applicationCommands(this.clientId),
        { body: commands }
      );

      console.log('✅ Commandes Discord enregistrées avec succès!');
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
  }

  async start(): Promise<void> {
    await this.registerCommands();
    await this.client.login(this.token);
    
    // Synchroniser les dépôts périodiquement (toutes les heures)
    setInterval(() => {
      this.solanaTracker.syncDeposits().catch(console.error);
    }, 60 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.client.destroy();
    console.log('👋 Bot Discord arrêté');
  }
}