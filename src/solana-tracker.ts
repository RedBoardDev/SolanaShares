import { Connection, PublicKey, ParsedTransactionWithMeta, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { db } from './database';

export interface DepositInfo {
  signature: string;
  fromAddress: string;
  amount: number; // en SOL
  timestamp: number;
  slot: number;
}

export class SolanaTracker {
  private connection: Connection;
  private hotWalletAddress: PublicKey;
  private lastProcessedSignature: string | null = null;

  constructor(rpcUrl: string, hotWalletAddress: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.hotWalletAddress = new PublicKey(hotWalletAddress);
  }

  /**
   * Récupère le solde actuel du hot wallet
   */
  async getHotWalletBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.hotWalletAddress);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Scan les dépôts vers le hot wallet
   */
  async scanDeposits(limit: number = 1000): Promise<DepositInfo[]> {
    const deposits: DepositInfo[] = [];
    
    try {
      // Récupérer les signatures de transactions
      const signatures = await this.connection.getSignaturesForAddress(
        this.hotWalletAddress,
        {
          limit,
          until: this.lastProcessedSignature || undefined,
        }
      );

      console.log(`📥 Analyse de ${signatures.length} transactions...`);

      // Analyser chaque transaction
      for (const sigInfo of signatures) {
        const tx = await this.connection.getParsedTransaction(
          sigInfo.signature,
          {
            maxSupportedTransactionVersion: 0,
          }
        );

        if (!tx || !tx.meta || tx.meta.err) continue;

        // Analyser les transferts entrants
        const deposit = this.extractDepositInfo(tx, sigInfo.signature);
        if (deposit) {
          deposits.push(deposit);
        }
      }

      // Mettre à jour la dernière signature traitée
      if (signatures.length > 0) {
        this.lastProcessedSignature = signatures[0].signature;
      }

      return deposits.reverse(); // Ordre chronologique
    } catch (error) {
      console.error('Erreur lors du scan des dépôts:', error);
      return [];
    }
  }

  /**
   * Extrait les informations de dépôt d'une transaction
   */
  private extractDepositInfo(tx: ParsedTransactionWithMeta, signature: string): DepositInfo | null {
    if (!tx.meta || !tx.blockTime) return null;

    const hotWalletStr = this.hotWalletAddress.toBase58();
    
    // Chercher les transferts SOL vers le hot wallet
    const instructions = tx.transaction.message.instructions;
    
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed) {
        const parsed = instruction.parsed;
        
        // Vérifier si c'est un transfert SOL
        if (parsed.type === 'transfer' && parsed.info) {
          const info = parsed.info;
          
          // Vérifier si c'est un dépôt vers notre hot wallet
          if (info.destination === hotWalletStr && info.lamports) {
            return {
              signature,
              fromAddress: info.source,
              amount: info.lamports / LAMPORTS_PER_SOL,
              timestamp: tx.blockTime * 1000, // Convertir en millisecondes
              slot: tx.slot,
            };
          }
        }
      }
    }

    // Analyser aussi les changements de balance via les comptes
    const accountKeys = tx.transaction.message.accountKeys;
    const postBalances = tx.meta.postBalances;
    const preBalances = tx.meta.preBalances;
    
    let hotWalletIndex = -1;
    let hotWalletChange = 0;
    
    // Trouver l'index du hot wallet et son changement de balance
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      const address = typeof key === 'string' ? key : 'pubkey' in key ? key.pubkey.toBase58() : '';
      
      if (address === hotWalletStr) {
        hotWalletIndex = i;
        hotWalletChange = postBalances[i] - preBalances[i];
        break;
      }
    }
    
    // Si le hot wallet a reçu des SOL
    if (hotWalletIndex >= 0 && hotWalletChange > 0) {
      // Trouver qui a envoyé (celui qui a perdu au moins autant de SOL)
      for (let j = 0; j < accountKeys.length; j++) {
        if (j !== hotWalletIndex && preBalances[j] - postBalances[j] >= hotWalletChange) {
          const senderKey = accountKeys[j];
          const senderAddress = typeof senderKey === 'string' ? senderKey : 'pubkey' in senderKey ? senderKey.pubkey.toBase58() : '';
          
          if (senderAddress) {
            return {
              signature,
              fromAddress: senderAddress,
              amount: hotWalletChange / LAMPORTS_PER_SOL,
              timestamp: tx.blockTime * 1000,
              slot: tx.slot,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Synchronise les dépôts avec la base de données
   */
  async syncDeposits(): Promise<void> {
    console.log('🔄 Synchronisation des dépôts on-chain...');
    
    const deposits = await this.scanDeposits();
    let newDeposits = 0;

    for (const deposit of deposits) {
      // Vérifier si le dépôt existe déjà
      const existing = await db.getInvestmentBySignature(deposit.signature);
      if (existing) continue;

      // Chercher l'utilisateur associé à ce wallet
      const userWallet = await db.getUserByWallet(deposit.fromAddress);
      
      if (userWallet) {
        // Enregistrer le dépôt
        await db.addInvestment(
          userWallet.userId,
          userWallet.username,
          deposit.amount,
          deposit.signature,
          deposit.timestamp
        );
        newDeposits++;
        console.log(`✅ Nouveau dépôt détecté: ${deposit.amount} SOL de ${userWallet.username}`);
      } else {
        console.log(`⚠️  Dépôt de ${deposit.amount} SOL depuis un wallet non associé: ${deposit.fromAddress}`);
      }
    }

    console.log(`📊 Synchronisation terminée: ${newDeposits} nouveaux dépôts`);
  }

  /**
   * Calcule les shares historiques à un moment donné
   */
  async calculateHistoricalShares(timestamp: number): Promise<Map<string, number>> {
    const investments = await db.getAllInvestments();
    const userTotals = new Map<string, number>();
    let totalPool = 0;

    // Calculer les totaux investis jusqu'au timestamp
    for (const investment of investments) {
      if (investment.timestamp <= timestamp) {
        const current = userTotals.get(investment.userId) || 0;
        userTotals.set(investment.userId, current + investment.amount);
        totalPool += investment.amount;
      }
    }

    // Convertir en pourcentages
    const shares = new Map<string, number>();
    for (const [userId, amount] of userTotals) {
      shares.set(userId, totalPool > 0 ? amount / totalPool : 0);
    }

    return shares;
  }

  /**
   * Récupère le prix du SOL en USD
   */
  async getSolPrice(): Promise<number> {
    try {
      // Ici on pourrait utiliser une API de prix
      // Pour l'instant, retourner une valeur fixe
      return 100; // À remplacer par un appel API réel
    } catch (error) {
      console.error('Erreur lors de la récupération du prix SOL:', error);
      return 100;
    }
  }
}