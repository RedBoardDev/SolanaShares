import type { ParticipantEntity } from '@domain/entities/participant.entity';
import type { GlobalStatsEntity } from '@domain/entities/global-stats.entity';
import { logger } from '@helpers/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheService {
  private static instance: CacheService;
  private readonly TTL_MS = 15 * 60_000;

  private participantCache = new Map<string, CacheEntry<ParticipantEntity>>();
  private participantByDiscordUserCache = new Map<string, string>();

  private globalStatsCache: CacheEntry<GlobalStatsEntity> | null = null;

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  getParticipant(walletAddress: string): ParticipantEntity | null {
    const entry = this.participantCache.get(walletAddress);
    if (!entry) return null;

    if (this.isExpired(entry.timestamp)) {
      this.participantCache.delete(walletAddress);
      this.removeParticipantFromDiscordUserCache(walletAddress);
      return null;
    }

    return entry.data;
  }

  getParticipantByWalletAddress(walletAddress: string): ParticipantEntity | null {
    return this.getParticipant(walletAddress);
  }

  getParticipantByDiscordUser(discordUser: string): ParticipantEntity | null {
    const walletAddress = this.participantByDiscordUserCache.get(discordUser);
    if (!walletAddress) return null;

    return this.getParticipant(walletAddress);
  }

  setParticipant(participant: ParticipantEntity): void {
    this.participantCache.set(participant.walletAddress, {
      data: participant,
      timestamp: Date.now(),
    });

    this.participantByDiscordUserCache.set(participant.userId, participant.walletAddress);
  }

  removeParticipant(walletAddress: string): void {
    const entry = this.participantCache.get(walletAddress);
    if (entry) {
      this.participantCache.delete(walletAddress);
      this.removeParticipantFromDiscordUserCache(walletAddress);
    }
  }

  getAllParticipants(): ParticipantEntity[] {
    const participants: ParticipantEntity[] = [];

    for (const [walletAddress, entry] of this.participantCache) {
      if (this.isExpired(entry.timestamp)) {
        this.participantCache.delete(walletAddress);
        this.removeParticipantFromDiscordUserCache(walletAddress);
      } else {
        participants.push(entry.data);
      }
    }

    return participants;
  }

  getGlobalStats(): GlobalStatsEntity | null {
    if (!this.globalStatsCache) return null;

    if (this.isExpired(this.globalStatsCache.timestamp)) {
      this.globalStatsCache = null;
      return null;
    }

    return this.globalStatsCache.data;
  }

  setGlobalStats(globalStats: GlobalStatsEntity): void {
    this.globalStatsCache = {
      data: globalStats,
      timestamp: Date.now(),
    };
  }

  removeGlobalStats(): void {
    this.globalStatsCache = null;
  }

  clear(): void {
    this.participantCache.clear();
    this.participantByDiscordUserCache.clear();
    this.globalStatsCache = null;
    logger.info('Cache cleared');
  }

  getStats(): { participants: number; globalStats: boolean } {
    return {
      participants: this.participantCache.size,
      globalStats: this.globalStatsCache !== null,
    };
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.TTL_MS;
  }

  private removeParticipantFromDiscordUserCache(walletAddress: string): void {
    for (const [discordUser, cachedWalletAddress] of this.participantByDiscordUserCache) {
      if (cachedWalletAddress === walletAddress) {
        this.participantByDiscordUserCache.delete(discordUser);
        break;
      }
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, this.TTL_MS / 2);
  }

  private cleanup(): void {
    for (const [walletAddress, entry] of this.participantCache) {
      if (this.isExpired(entry.timestamp)) {
        this.participantCache.delete(walletAddress);
        this.removeParticipantFromDiscordUserCache(walletAddress);
      }
    }

    if (this.globalStatsCache && this.isExpired(this.globalStatsCache.timestamp)) {
      this.globalStatsCache = null;
    }
  }
}
