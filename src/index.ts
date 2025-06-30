import dotenv from 'dotenv';
import { db } from './database';
import { PNLBot } from './bot';

// Charger les variables d'environnement
dotenv.config();

async function main() {
  try {
    console.log('🚀 Démarrage du bot PNL avec tracking on-chain...');

    // Vérifier les variables d'environnement
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const monthlyPoolCost = parseFloat(process.env.MONTHLY_COST_USD || '40');

    if (!token || !clientId || !hotWalletAddress) {
      throw new Error('Les variables DISCORD_TOKEN, DISCORD_CLIENT_ID et HOT_WALLET_ADDRESS sont requises!');
    }

    // Initialiser la base de données
    console.log('📁 Initialisation de la base de données...');
    await db.initialize();
    console.log('✅ Base de données initialisée');

    // Créer et démarrer le bot
    const bot = new PNLBot(token, clientId, rpcUrl, hotWalletAddress, monthlyPoolCost);
    
    console.log('🔗 Hot wallet: ' + hotWalletAddress);
    console.log('💰 Coût mensuel: $' + monthlyPoolCost);
    
    await bot.start();

    // Gérer l'arrêt propre
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Arrêt du bot...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n⏹️  Arrêt du bot...');
      await bot.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Démarrer l'application
main();