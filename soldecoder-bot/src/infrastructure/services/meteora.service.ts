import {
  type MeteoraDeposit,
  type MeteoraPosition,
  MeteoraPositionSchema,
  MeteoraDepositSchema,
  type MeteoraClaimReward,
  MeteoraClaimRewardSchema,
  type MeteoraClaimFee,
  MeteoraClaimFeeSchema,
  type MeteoraWithdrawal,
  MeteoraWithdrawalSchema,
} from '@schemas/meteora-position.schema';
import { type MeteoraPair, MeteoraPairSchema } from '@schemas/meteora-pair.schema';
import { RateLimiter } from './rate-limiter.service';

export class MeteoraApiService {
  private static instance: MeteoraApiService;
  private readonly baseUrl = 'https://dlmm-api.meteora.ag';
  private readonly rateLimiter: RateLimiter;

  private constructor() {
    this.rateLimiter = new RateLimiter(100);
  }

  public static getInstance(): MeteoraApiService {
    if (!MeteoraApiService.instance) {
      MeteoraApiService.instance = new MeteoraApiService();
    }
    return MeteoraApiService.instance;
  }

  private async fetchFromApi<T>(endpoint: string): Promise<T> {
    return this.rateLimiter.enqueue(async () => {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API request failed for ${this.baseUrl}${endpoint}: ${response.status} ${response.statusText}`);
      }
      return response.json() as T;
    });
  }

  public async getPosition(txSignature: string): Promise<MeteoraPosition> {
    const data = await this.fetchFromApi(`/position/${txSignature}`);
    return MeteoraPositionSchema.parse(data);
  }

  public async getDeposits(txSignature: string): Promise<MeteoraDeposit[]> {
    const data = await this.fetchFromApi(`/position/${txSignature}/deposits`);
    return MeteoraDepositSchema.array().parse(data);
  }

  public async getClaimRewards(txSignature: string): Promise<MeteoraClaimReward[]> {
    const data = await this.fetchFromApi(`/position/${txSignature}/claim_rewards`);
    return MeteoraClaimRewardSchema.array().parse(data);
  }

  public async getClaimFees(txSignature: string): Promise<MeteoraClaimFee[]> {
    const data = await this.fetchFromApi(`/position/${txSignature}/claim_fees`);
    return MeteoraClaimFeeSchema.array().parse(data);
  }

  public async getWithdrawals(txSignature: string): Promise<MeteoraWithdrawal[]> {
    const data = await this.fetchFromApi(`/position/${txSignature}/withdraws`);
    return MeteoraWithdrawalSchema.array().parse(data);
  }

  public async getPair(pairAddress: string): Promise<MeteoraPair> {
    const data = await this.fetchFromApi(`/pair/${pairAddress}`);
    return MeteoraPairSchema.parse(data);
  }
}
