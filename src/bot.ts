import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction } from 'discord.js';
import { PNLCalculator } from './pnl-calculator';
import { db } from './database';

export class PNLBot {
  private client: Client;
  private pnlCalculator: PNLCalculator;
  private token: string;
  private clientId: string;
  private currentPoolValue: number = 0; // Valeur actuelle du pool (à mettre à jour)

  constructor(token: string, clientId: string, monthlyPoolCost: number = 40) {
    this.token = token;
    this.clientId = clientId;
    this.pnlCalculator = new PNLCalculator(monthlyPoolCost);
    
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
      case 'invest':
        await this.handleInvestCommand(interaction);
        break;
      case 'pool':
        await this.handlePoolCommand(interaction);
        break;
      case 'setpool':
        await this.handleSetPoolCommand(interaction);
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
    const pnl = await this.pnlCalculator.calculateUserPNL(userId, this.currentPoolValue);

    if (!pnl) {
      await interaction.editReply({
        content: '❌ Vous n\'avez pas encore investi dans le pool.',
      });
      return;
    }

    const display = this.pnlCalculator.formatPNLForDisplay(pnl);
    await interaction.editReply({
      content: display,
    });
  }

  private async handleInvestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const amount = interaction.options.getNumber('amount', true);
    
    if (amount <= 0) {
      await interaction.reply({
        content: '❌ Le montant doit être supérieur à 0.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    await db.addInvestment(
      interaction.user.id,
      interaction.user.username,
      amount
    );

    await interaction.editReply({
      content: `✅ Investissement de **$${amount.toFixed(2)}** enregistré avec succès!\n` +
               `Utilisez \`/pnl\` pour voir votre performance.`,
    });
  }

  private async handlePoolCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const totalInvested = await db.getTotalInvested();
    const investorsCount = await db.getUniqueInvestorsCount();
    const latestSnapshot = await db.getLatestSnapshot();
    
    const pnlTotal = this.currentPoolValue - totalInvested;
    const pnlPercentage = totalInvested > 0 ? (pnlTotal / totalInvested) * 100 : 0;
    const sign = pnlTotal >= 0 ? '+' : '';

    let content = `📊 **État du Pool de Trading**\n\n` +
                  `👥 Nombre d'investisseurs: **${investorsCount}**\n` +
                  `💰 Total investi: **$${totalInvested.toFixed(2)}**\n` +
                  `💎 Valeur actuelle: **$${this.currentPoolValue.toFixed(2)}**\n` +
                  `📈 PNL Global: **${sign}$${pnlTotal.toFixed(2)} (${sign}${pnlPercentage.toFixed(2)}%)**\n`;

    if (latestSnapshot) {
      const date = new Date(latestSnapshot.timestamp);
      content += `\n📅 Dernière mise à jour: ${date.toLocaleString()}`;
    }

    await interaction.editReply({ content });
  }

  private async handleSetPoolCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Vérifier si l'utilisateur est admin (à adapter selon vos besoins)
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ Seuls les administrateurs peuvent mettre à jour la valeur du pool.',
        ephemeral: true,
      });
      return;
    }

    const value = interaction.options.getNumber('value', true);
    
    if (value < 0) {
      await interaction.reply({
        content: '❌ La valeur du pool ne peut pas être négative.',
        ephemeral: true,
      });
      return;
    }

    this.currentPoolValue = value;
    await db.addPoolSnapshot(value);

    await interaction.reply({
      content: `✅ Valeur du pool mise à jour: **$${value.toFixed(2)}**`,
      ephemeral: true,
    });
  }

  async registerCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('pnl')
        .setDescription('Affiche votre PNL personnel avec prise en compte des frais'),
      
      new SlashCommandBuilder()
        .setName('invest')
        .setDescription('Enregistre un nouvel investissement')
        .addNumberOption(option =>
          option.setName('amount')
            .setDescription('Montant investi en USD')
            .setRequired(true)
            .setMinValue(0.01)
        ),
      
      new SlashCommandBuilder()
        .setName('pool')
        .setDescription('Affiche les statistiques globales du pool'),
      
      new SlashCommandBuilder()
        .setName('setpool')
        .setDescription('Met à jour la valeur actuelle du pool (Admin uniquement)')
        .addNumberOption(option =>
          option.setName('value')
            .setDescription('Valeur totale actuelle du pool en USD')
            .setRequired(true)
            .setMinValue(0)
        ),
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
  }

  async stop(): Promise<void> {
    this.client.destroy();
    console.log('👋 Bot Discord arrêté');
  }
}