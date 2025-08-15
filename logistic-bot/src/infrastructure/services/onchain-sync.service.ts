import { OnChainSyncService as IOnChainSyncService } from '@domain/interfaces/onchain-sync.service.interface';
import { ParticipantEntity } from '@domain/entities/participant.entity';
import { ParticipantRepository } from '@domain/interfaces/participant.repository.interface';
import { GlobalStatsRepository } from '@domain/interfaces/global-stats.repository.interface';
import { DynamoParticipantRepository } from '@infrastructure/repositories/dynamo-participants.repository';
import { DynamoGlobalStatsRepository } from '@infrastructure/repositories/dynamo-global-stats.repository';
import { SolanaWeb3Service } from '@infrastructure/services/solanaweb3.service';
import { logger } from '@helpers/logger';
import { config } from '@infrastructure/config/env';
import { GlobalStatsEntity } from '@domain/entities/global-stats.entity';
import { WalletAddress } from '@domain/value-objects/wallet-address';
import {
  LAMPORTS_PER_SOL,
  type ParsedInstruction,
  type ParsedTransactionWithMeta,
  Connection,
  PublicKey
} from '@solana/web3.js';

export interface WalletTransaction {
  timestamp: Date;
  txHash: string;
  amount: number;
  actionType: string;
}

export interface WalletDetails {
  wallet: string;
  amount: number;
  transactions: WalletTransaction[];
}

type SyncStage = 'idle' | 'scanning' | 'processing' | 'updating_participants' | 'updating_stats' | 'completed' | 'error';
export interface SyncStatus {
  isRunning: boolean;
  stage: SyncStage;
  startedAt?: number;
  updatedAt?: number;
  totalParticipants?: number;
  processedParticipants?: number;
  totalTransactions?: number;
  processedTransactions?: number;
  error?: string | null;
}

interface AggregateRecord {
  inLamports: number;
  inSignatures: Set<string>;
  outLamports: number;
  outSignatures: Set<string>;
  hadReturn: boolean;
  transactions: WalletTransaction[];
}

export class OnChainSyncService {
  private static instance: OnChainSyncService | null = null;

  // private readonly participantRepository: ParticipantRepository;
  // private readonly globalStatsRepository: GlobalStatsRepository;
  private readonly solanaService: SolanaWeb3Service;
  private readonly targetAddress: string;

  private readonly SIG_PAGE_LIMIT = 50;
  private readonly MAX_SIGS_PER_ADDRESS = 5000;

  private syncStatus: SyncStatus = { isRunning: false, stage: 'idle' };

  static getInstance(): OnChainSyncService {
    if (!OnChainSyncService.instance) {
      OnChainSyncService.instance = new OnChainSyncService();
    }
    return OnChainSyncService.instance;
  }

  constructor(
    // participantRepository?: ParticipantRepository,
    // globalStatsRepository?: GlobalStatsRepository,
    solanaService?: SolanaWeb3Service,
  ) {
    this.targetAddress = config.solana.phase.wallet;
    this.solanaService = solanaService || SolanaWeb3Service.getInstance();
  }

  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  private setStatus(partial: Partial<SyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...partial, updatedAt: Date.now() };
  }

  private extractParsedInstructions(parsedTx: ParsedTransactionWithMeta): any[] {
    const topLevel = parsedTx.transaction.message.instructions || [];
    const inner = (parsedTx.meta?.innerInstructions || []).flatMap((ix) => ix.instructions || []);
    return [...topLevel, ...inner];
  }

  private isSystemTransferToTarget(ix: any, targetBase58: string): boolean {
    if (!ix || ix.program !== 'system' || !ix.parsed) return false;

    const parsed = ix.parsed;
    if (parsed.type !== 'transfer') return false;

    const info = parsed.info || {};
    return info.destination === targetBase58 &&
           typeof info.lamports === 'number' &&
           info.lamports > 0;
  }

  private isSystemTransferFromTarget(ix: any, targetBase58: string): boolean {
    if (!ix || ix.program !== 'system' || !ix.parsed) return false;

    const parsed = ix.parsed;
    if (parsed.type !== 'transfer') return false;

    const info = parsed.info || {};
    return info.source === targetBase58 &&
           typeof info.lamports === 'number' &&
           info.lamports > 0;
  }

  private processTransaction(
    tx: ParsedTransactionWithMeta | null,
    sig: string,
    blockTime: number,
    limitedWallets: Set<string>,
    aggregate: Map<string, AggregateRecord>
  ): void {
    if (!tx || !tx.meta) return;

    const when = new Date(blockTime * 1000);
    const instructions = this.extractParsedInstructions(tx);

    for (const ix of instructions) {
      if (this.isSystemTransferToTarget(ix, this.targetAddress)) {
        const info = ix.parsed.info;
        const source = info.source;
        const lamports = info.lamports || 0;

        if (limitedWallets.has(source)) {
          const rec = aggregate.get(source);
          if (rec) {
            rec.inLamports += lamports;
            rec.inSignatures.add(sig);
            rec.transactions.push({
              timestamp: when,
              txHash: sig,
              amount: lamports / LAMPORTS_PER_SOL,
              actionType: 'in'
            });
          }
        }
      } else if (this.isSystemTransferFromTarget(ix, this.targetAddress)) {
        const info = ix.parsed.info;
        const dest = info.destination;
        const lamports = info.lamports || 0;

        if (limitedWallets.has(dest)) {
          const rec = aggregate.get(dest);
          if (rec) {
            rec.outLamports += lamports;
            rec.outSignatures.add(sig);
            rec.hadReturn = true;
            rec.transactions.push({
              timestamp: when,
              txHash: sig,
              amount: -lamports / LAMPORTS_PER_SOL,
              actionType: 'out'
            });
          }
        }
      }
    }
  }

  private async processIndividualTransactions(
    filteredSigInfos: {signature: string, blockTime: number}[],
    limitedWallets: Set<string>,
    aggregate: Map<string, AggregateRecord>,
    cutoffEpochSec: number
  ): Promise<void> {
    this.setStatus({ stage: 'processing', totalTransactions: filteredSigInfos.length, processedTransactions: 0 });
    for (let i = 0; i < filteredSigInfos.length; i++) {
      const sigInfo = filteredSigInfos[i];
      const sig = sigInfo.signature;
      const tx = await this.solanaService.getParsedTransaction(sig);

      if (typeof sigInfo.blockTime !== 'number' || sigInfo.blockTime >= cutoffEpochSec) {
        this.setStatus({ processedTransactions: (this.syncStatus.processedTransactions ?? 0) + 1 });
        continue;
      }

      this.processTransaction(tx, sig, sigInfo.blockTime, limitedWallets, aggregate);
      this.setStatus({ processedTransactions: (this.syncStatus.processedTransactions ?? 0) + 1 });
    }
  }

  private async scanTargetForWallets(
    limitedWallets: Set<string>,
    asOfEpochSec: number
  ): Promise<Map<string, AggregateRecord>> {
    const target = new PublicKey(this.targetAddress);

    const aggregate = new Map<string, AggregateRecord>();
    for (const addr of limitedWallets) {
      if (addr === this.targetAddress) continue;
      aggregate.set(addr, {
        inLamports: 0,
        inSignatures: new Set(),
        outLamports: 0,
        outSignatures: new Set(),
        hadReturn: false,
        transactions: []
      });
    }

    this.setStatus({ stage: 'scanning' });
    const sigInfos = await this.solanaService.getAllSignaturesForAddress(this.targetAddress, {
      pageLimit: this.SIG_PAGE_LIMIT,
      maxTotal: this.MAX_SIGS_PER_ADDRESS,
      stopOnCutoffEpochSec: null,
    });
    const filtered = sigInfos.filter((s) => typeof s.blockTime === 'number' && s.blockTime < asOfEpochSec);

    await this.processIndividualTransactions(filtered as any, limitedWallets, aggregate, asOfEpochSec);

    return aggregate;
  }

  public async getWalletsDetails(wallets: string[], asOfDate: Date): Promise<WalletDetails[]> {
    const asOfEpoch = Math.floor(asOfDate.getTime() / 1000);
    const walletSet = new Set(wallets);

    const aggregate = await this.scanTargetForWallets(walletSet, asOfEpoch);

    const details: WalletDetails[] = [];
    for (const wallet of wallets) {
      const rec = aggregate.get(wallet);
      if (!rec) {
        details.push({ wallet, amount: 0, transactions: [] });
        continue;
      }

      const total = rec.transactions.reduce((sum, t) => sum + t.amount, 0);
      const txs = rec.transactions.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      details.push({ wallet, amount: total, transactions: txs });
    }

    return details;
  }

  public async syncAllParticipants(asOfDate: Date): Promise<WalletDetails[]> {
    if (this.syncStatus.isRunning) {
      logger.warn('Sync already running, skipping new invocation');
      return [];
    }
    this.syncStatus = { isRunning: true, stage: 'scanning', startedAt: Date.now(), updatedAt: Date.now(), error: null };

    try {
      const participantRepo = new DynamoParticipantRepository();
      const globalRepo = new DynamoGlobalStatsRepository();

      const participants = await participantRepo.getAll();
      const wallets = participants.map((p) => p.walletAddress);
      this.setStatus({ totalParticipants: participants.length, processedParticipants: 0 });

      const details = await this.getWalletsDetails(wallets, asOfDate);

      this.setStatus({ stage: 'updating_participants' });
      let totalInvested = 0;
      const minSolAmount = Number.parseFloat(config.solana.phase.farmer.minSolAmount);
      let activeParticipants = 0;

      for (let i = 0; i < details.length; i++) {
        const detail = details[i];
        const participant = participants.find((p) => p.walletAddress === detail.wallet);
        if (!participant) {
          this.setStatus({ processedParticipants: (this.syncStatus.processedParticipants ?? 0) + 1 });
          continue;
        }

        const newAmount = Math.max(0, detail.amount);
        totalInvested += newAmount;
        if (newAmount >= minSolAmount) {
          activeParticipants++;
        }

        if (participant.investedAmount !== newAmount) {
          const updatedParticipant = participant.updateInvestedAmount(newAmount);
          await participantRepo.update(updatedParticipant);
        }

        this.setStatus({ processedParticipants: (this.syncStatus.processedParticipants ?? 0) + 1 });
      }

      this.setStatus({ stage: 'updating_stats' });
      const globalStats = GlobalStatsEntity.restore({
        type: 'GLOBAL_STATS',
        totalInvested,
        participantCount: participants.length,
        activeParticipants,
        updatedAt: Date.now(),
      });
      await globalRepo.updateGlobalStats(globalStats);

      this.syncStatus = { ...this.syncStatus, isRunning: false, stage: 'completed', updatedAt: Date.now() };
      return details;
    } catch (error) {
      logger.error('syncAllParticipants failed', error as Error);
      this.syncStatus = { ...this.syncStatus, isRunning: false, stage: 'error', error: (error as Error).message, updatedAt: Date.now() };
      throw error;
    }
  }
}
