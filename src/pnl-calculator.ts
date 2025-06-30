import { db, Investment } from './database';
import { SolanaTracker } from './solana-tracker';

export interface UserPNL {
  userId: string;
  username: string;
  totalInvestedSOL: number;
  totalInvestedUSD: number;
  currentSharePercentage: number;
  currentValueSOL: number;
  currentValueUSD: number;
  monthlyFeesUSD: number;
  grossPNL_USD: number;
  netPNL_USD: number;
  pnlPercentage: number;
}

export class PNLCalculator {
  private monthlyPoolCost: number;
  private solanaTracker: SolanaTracker;

  constructor(solanaTracker: SolanaTracker, monthlyPoolCost: number = 40) {
    this.solanaTracker = solanaTracker;
    this.monthlyPoolCost = monthlyPoolCost;
  }

  /**
   * Calcule les parts d'un utilisateur en tenant compte de l'historique
   * Les parts évoluent à chaque nouveau dépôt dans le pool
   */
  private async calculateUserShareEvolution(userId: string, investments: Investment[]): Promise<{share: number, weightedMonths: number}> {
    // Trier par timestamp
    const sortedInvestments = [...investments].sort((a, b) => a.timestamp - b.timestamp);
    
    let totalWeightedShare = 0;
    let totalDuration = 0;
    const now = Date.now();

    // Pour chaque période entre les investissements
    for (let i = 0; i < sortedInvestments.length; i++) {
      const investmentTime = sortedInvestments[i].timestamp;
      const nextTime = i < sortedInvestments.length - 1 ? sortedInvestments[i + 1].timestamp : now;
      const duration = nextTime - investmentTime;

      // Calculer les shares à ce moment
      const shares = await this.solanaTracker.calculateHistoricalShares(investmentTime);
      const userShare = shares.get(userId) || 0;

      // Pondérer par la durée
      totalWeightedShare += userShare * duration;
      totalDuration += duration;
    }

    // Share moyenne pondérée
    const averageShare = totalDuration > 0 ? totalWeightedShare / totalDuration : 0;
    
    // Calculer le nombre de mois pondéré pour les frais
    const monthsInMillis = 30 * 24 * 60 * 60 * 1000;
    const weightedMonths = totalWeightedShare / monthsInMillis;

    return { share: averageShare, weightedMonths };
  }

  /**
   * Calcule le PNL pour un utilisateur
   */
  async calculateUserPNL(userId: string): Promise<UserPNL | null> {
    const userInvestments = await db.getUserInvestments(userId);
    if (userInvestments.length === 0) return null;

    // Synchroniser les dépôts on-chain
    await this.solanaTracker.syncDeposits();

    // Récupérer le solde actuel du hot wallet
    const currentBalanceSOL = await this.solanaTracker.getHotWalletBalance();
    const solPrice = await this.solanaTracker.getSolPrice();
    const currentBalanceUSD = currentBalanceSOL * solPrice;

    // Total investi par l'utilisateur
    const userTotalSOL = userInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const userTotalUSD = userTotalSOL * solPrice; // Approximation au prix actuel

    // Calculer les shares actuelles
    const currentShares = await this.solanaTracker.calculateHistoricalShares(Date.now());
    const currentShare = currentShares.get(userId) || 0;

    // Valeur actuelle des parts de l'utilisateur
    const currentValueSOL = currentBalanceSOL * currentShare;
    const currentValueUSD = currentValueSOL * solPrice;

    // Calculer les frais mensuels basés sur l'évolution des shares
    const { weightedMonths } = await this.calculateUserShareEvolution(userId, await db.getAllInvestments());
    const monthlyFeesUSD = this.monthlyPoolCost * weightedMonths;

    // PNL
    const grossPNL_USD = currentValueUSD - userTotalUSD;
    const netPNL_USD = grossPNL_USD - monthlyFeesUSD;
    const pnlPercentage = userTotalUSD > 0 ? (netPNL_USD / userTotalUSD) * 100 : 0;

    return {
      userId,
      username: userInvestments[0].username,
      totalInvestedSOL: userTotalSOL,
      totalInvestedUSD: userTotalUSD,
      currentSharePercentage: currentShare * 100,
      currentValueSOL,
      currentValueUSD,
      monthlyFeesUSD,
      grossPNL_USD,
      netPNL_USD,
      pnlPercentage
    };
  }

  /**
   * Formate le PNL pour Discord
   */
  formatPNLForDisplay(pnl: UserPNL): string {
    const signGross = pnl.grossPNL_USD >= 0 ? '+' : '';
    const signNet = pnl.netPNL_USD >= 0 ? '+' : '';
    const emoji = pnl.netPNL_USD >= 0 ? '📈' : '📉';
    
    return `${emoji} **PNL pour ${pnl.username}**\n\n` +
           `💰 **Investissements:**\n` +
           `   • Total: **${pnl.totalInvestedSOL.toFixed(4)} SOL** (~$${pnl.totalInvestedUSD.toFixed(2)})\n\n` +
           `📊 **Position actuelle:**\n` +
           `   • Part du pool: **${pnl.currentSharePercentage.toFixed(2)}%**\n` +
           `   • Valeur: **${pnl.currentValueSOL.toFixed(4)} SOL** (~$${pnl.currentValueUSD.toFixed(2)})\n\n` +
           `💸 **Performance:**\n` +
           `   • PNL Brut: **${signGross}$${pnl.grossPNL_USD.toFixed(2)}**\n` +
           `   • Frais mensuels: **-$${pnl.monthlyFeesUSD.toFixed(2)}**\n` +
           `   • PNL Net: **${signNet}$${pnl.netPNL_USD.toFixed(2)} (${signNet}${pnl.pnlPercentage.toFixed(2)}%)**`;
  }

  /**
   * Récupère les statistiques globales du pool
   */
  async getPoolStats(): Promise<{
    totalInvestedSOL: number;
    totalInvestedUSD: number;
    currentValueSOL: number;
    currentValueUSD: number;
    totalPNL_USD: number;
    pnlPercentage: number;
    investorsCount: number;
  }> {
    await this.solanaTracker.syncDeposits();

    const totalInvestedSOL = await db.getTotalInvested();
    const currentValueSOL = await this.solanaTracker.getHotWalletBalance();
    const solPrice = await this.solanaTracker.getSolPrice();
    
    const totalInvestedUSD = totalInvestedSOL * solPrice;
    const currentValueUSD = currentValueSOL * solPrice;
    const totalPNL_USD = currentValueUSD - totalInvestedUSD;
    const pnlPercentage = totalInvestedUSD > 0 ? (totalPNL_USD / totalInvestedUSD) * 100 : 0;
    const investorsCount = await db.getUniqueInvestorsCount();

    return {
      totalInvestedSOL,
      totalInvestedUSD,
      currentValueSOL,
      currentValueUSD,
      totalPNL_USD,
      pnlPercentage,
      investorsCount
    };
  }
}