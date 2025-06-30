import { db, Investment } from './database';

export interface UserPNL {
  userId: string;
  username: string;
  totalInvested: number;
  currentShare: number; // Pourcentage de parts dans le pool
  shareValue: number;   // Valeur actuelle des parts
  monthlyFees: number;  // Frais mensuels à payer
  netPNL: number;       // PNL net après frais
  pnlPercentage: number; // PNL en pourcentage
}

export class PNLCalculator {
  private monthlyPoolCost: number;

  constructor(monthlyPoolCost: number = 40) {
    this.monthlyPoolCost = monthlyPoolCost;
  }

  /**
   * Calcule les shares de chaque utilisateur à un moment donné
   */
  private calculateSharesAtTime(investments: Investment[], timestamp: number): Map<string, number> {
    const userShares = new Map<string, number>();
    let totalPool = 0;

    // Filtrer les investissements jusqu'au timestamp donné
    const relevantInvestments = investments.filter(inv => inv.timestamp <= timestamp);
    
    // Calculer le total investi par chaque utilisateur
    for (const investment of relevantInvestments) {
      const current = userShares.get(investment.userId) || 0;
      userShares.set(investment.userId, current + investment.amount);
      totalPool += investment.amount;
    }

    // Convertir en pourcentages
    const sharePercentages = new Map<string, number>();
    for (const [userId, amount] of userShares) {
      sharePercentages.set(userId, totalPool > 0 ? (amount / totalPool) : 0);
    }

    return sharePercentages;
  }

  /**
   * Calcule les frais mensuels pour chaque utilisateur
   */
  private calculateMonthlyFees(userShare: number, totalMonths: number): number {
    return userShare * this.monthlyPoolCost * totalMonths;
  }

  /**
   * Calcule le nombre de mois depuis le premier investissement
   */
  private calculateMonthsSinceStart(investments: Investment[]): number {
    if (investments.length === 0) return 0;

    const firstInvestment = Math.min(...investments.map(inv => inv.timestamp));
    const now = Date.now();
    const monthsDiff = (now - firstInvestment) / (1000 * 60 * 60 * 24 * 30); // Approximation simple
    
    return Math.max(0, monthsDiff);
  }

  /**
   * Calcule le PNL pour un utilisateur spécifique
   */
  async calculateUserPNL(userId: string, currentPoolValue: number): Promise<UserPNL | null> {
    const userInvestments = await db.getUserInvestments(userId);
    if (userInvestments.length === 0) return null;

    const allInvestments = await db.getAllInvestments();
    const totalInvested = await db.getTotalInvested();
    const userTotalInvested = await db.getTotalInvestedByUser(userId);

    // Calculer la part actuelle de l'utilisateur
    const currentShares = this.calculateSharesAtTime(allInvestments, Date.now());
    const userShare = currentShares.get(userId) || 0;

    // Valeur actuelle des parts de l'utilisateur
    const shareValue = currentPoolValue * userShare;

    // Calculer les frais mensuels
    const totalMonths = this.calculateMonthsSinceStart(userInvestments);
    const monthlyFees = this.calculateMonthlyFees(userShare, totalMonths);

    // PNL net
    const grossPNL = shareValue - userTotalInvested;
    const netPNL = grossPNL - monthlyFees;
    const pnlPercentage = userTotalInvested > 0 ? (netPNL / userTotalInvested) * 100 : 0;

    return {
      userId,
      username: userInvestments[0].username,
      totalInvested: userTotalInvested,
      currentShare: userShare * 100, // En pourcentage
      shareValue,
      monthlyFees,
      netPNL,
      pnlPercentage
    };
  }

  /**
   * Calcule le PNL pour tous les utilisateurs
   */
  async calculateAllUsersPNL(currentPoolValue: number): Promise<UserPNL[]> {
    const allInvestments = await db.getAllInvestments();
    const uniqueUserIds = new Set(allInvestments.map(inv => inv.userId));
    
    const results: UserPNL[] = [];
    for (const userId of uniqueUserIds) {
      const pnl = await this.calculateUserPNL(userId, currentPoolValue);
      if (pnl) results.push(pnl);
    }

    return results;
  }

  /**
   * Formate le PNL pour l'affichage Discord
   */
  formatPNLForDisplay(pnl: UserPNL): string {
    const sign = pnl.netPNL >= 0 ? '+' : '';
    const emoji = pnl.netPNL >= 0 ? '📈' : '📉';
    
    return `${emoji} **PNL pour ${pnl.username}**\n` +
           `💰 Total investi: **$${pnl.totalInvested.toFixed(2)}**\n` +
           `📊 Part actuelle: **${pnl.currentShare.toFixed(2)}%**\n` +
           `💎 Valeur des parts: **$${pnl.shareValue.toFixed(2)}**\n` +
           `📅 Frais mensuels: **$${pnl.monthlyFees.toFixed(2)}**\n` +
           `━━━━━━━━━━━━━━━━━━━━\n` +
           `🎯 **PNL Net: ${sign}$${pnl.netPNL.toFixed(2)} (${sign}${pnl.pnlPercentage.toFixed(2)}%)**`;
  }
}