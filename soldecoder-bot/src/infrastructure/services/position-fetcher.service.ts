import { RateLimiter } from '@infrastructure/services/rate-limiter.service';
import { SolanaWeb3Service } from '@infrastructure/services/solanaweb3.service';
import { PositionData } from '@schemas/position-data.schema';
import { MeteoraApiService } from '@infrastructure/services/meteora.service';

export class PositionFetcher {
  private static _instance: PositionFetcher;
  private readonly limiter = new RateLimiter(500);
  private readonly solanaWeb3 = SolanaWeb3Service.getInstance();
  private readonly meteoraService = MeteoraApiService.getInstance();

  private constructor() {}

  static getInstance(): PositionFetcher {
    if (!PositionFetcher._instance) {
      PositionFetcher._instance = new PositionFetcher();
    }
    return PositionFetcher._instance;
  }

  async fetchPositions(hashs: string[]): Promise<PositionData[]> {
    const out: PositionData[] = [];

    for (const hash of hashs) {
      const position = await this.limiter.enqueue(async () => {
        const mainPositionTx = await this.solanaWeb3.getMainPosition(hash);

        const meteoraPosition = await this.meteoraService.getPosition(mainPositionTx);
        const meteoraDeposits = await this.meteoraService.getDeposits(mainPositionTx);
        const meteoraClaimRewards = await this.meteoraService.getClaimRewards(mainPositionTx);
        const meteoraClaimFees = await this.meteoraService.getClaimFees(mainPositionTx);
        const meteoraWithdrawals = await this.meteoraService.getWithdrawals(mainPositionTx);
        const meteoraPair = await this.meteoraService.getPair(meteoraPosition.pair_address);

        return { meteoraPosition, meteoraDeposits, meteoraClaimRewards, meteoraClaimFees, meteoraWithdrawals, meteoraPair };
      });
      out.push(position);
    }
    return out;
  }
}
