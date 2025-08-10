import { WalletInfoService as IWalletInfoService } from '@domain/interfaces/wallet-info.service.interface';
import { WalletInfo, WalletPosition, WalletInfoSchema, WalletPositionSchema } from '@schemas/lpagent.schema';
import { LpAgentService } from './lpagent.service';
import { config } from '@infrastructure/config/env';
import { logger } from '@helpers/logger';

export class WalletInfoService implements IWalletInfoService {
  private static instance: WalletInfoService;
  private static readonly RPC_URL = config.solana.rpcEndpoint;
  private static readonly RENT_FEE_PER_POSITION = 0.1;

  private lpAgentService: LpAgentService;
  private cachedWalletInfo: WalletInfo | null = null;
  private lastUpdateTime: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60_000;

  private constructor() {
    this.lpAgentService = LpAgentService.getInstance();
    logger.debug('🎯 WalletInfoService initialized');
  }

  static getInstance(): WalletInfoService {
    if (!WalletInfoService.instance) {
      WalletInfoService.instance = new WalletInfoService();
    }
    return WalletInfoService.instance;
  }

  public async getSolBalance(walletAddress?: string): Promise<number> {
    try {
      const response = await fetch(WalletInfoService.RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress]
        })
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        error?: { message: string };
        result?: { value: number };
      };

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const solBalance = (data.result?.value || 0) / 1e9; // Convert lamports to SOL
      return solBalance;

    } catch (error) {
      logger.error(
        '❌ Failed to fetch SOL balance',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async getPositions(walletAddress?: string): Promise<WalletPosition[]> {
    try {
      const lpAgentResponse = await this.lpAgentService.getOpeningPositions(walletAddress);

      const positions: WalletPosition[] = lpAgentResponse.data.map(position => ({
        status: position.status,
        token0: position.token0,
        token1: position.token1,
        pool: position.pool,
        pairName: position.pairName,
        valueNative: position.valueNative,
        currentValue: position.currentValue,
        inRange: position.inRange,
        pnl: position.pnl,
      }));

      const validatedPositions = positions.map(pos => WalletPositionSchema.parse(pos));
      return validatedPositions;

    } catch (error) {
      logger.error(
        '❌ Failed to fetch Meteora positions',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async getTotalNetWorth(walletAddress?: string): Promise<number> {
    try {
      const [solBalance, positions] = await Promise.all([
        this.getSolBalance(walletAddress),
        this.getPositions(walletAddress)
      ]);

      const positionsValue = positions.reduce((total, position) => {
        return total + position.valueNative + position.pnl.valueNative;
      }, 0);

      const rentFees = positions.length * WalletInfoService.RENT_FEE_PER_POSITION;

      const totalNetWorth = solBalance + positionsValue + rentFees;
      return totalNetWorth;

    } catch (error) {
      logger.error(
        '❌ Failed to calculate total net worth',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async getWalletInfo(walletAddress?: string): Promise<WalletInfo> {
    if (this.cachedWalletInfo && (Date.now() - this.lastUpdateTime) < this.CACHE_TTL_MS) {
      return this.cachedWalletInfo;
    }

    return this.updateAndGetWalletInfo(walletAddress);
  }


  public async updateWalletInfo(walletAddress?: string): Promise<void> {
    await this.updateAndGetWalletInfo(walletAddress);
  }

  private async updateAndGetWalletInfo(walletAddress?: string): Promise<WalletInfo> {
    try {
      const [solBalance, positions] = await Promise.all([
        this.getSolBalance(walletAddress),
        this.getPositions(walletAddress)
      ]);

      const positionsValue = positions.reduce((total, position) => {
        return total + position.valueNative + position.pnl.valueNative;
      }, 0);
      const rentFees = positions.length * WalletInfoService.RENT_FEE_PER_POSITION;
      const totalNetWorth = solBalance + positionsValue + rentFees;

      const walletInfo: WalletInfo = {
        solBalance,
        positions,
        totalNetWorth,
        lastUpdated: Date.now(),
      };

      const validatedWalletInfo = WalletInfoSchema.parse(walletInfo);

      this.cachedWalletInfo = validatedWalletInfo;
      this.lastUpdateTime = Date.now();

      return validatedWalletInfo;

    } catch (error) {
      logger.error(
        '❌ Failed to update wallet information',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
