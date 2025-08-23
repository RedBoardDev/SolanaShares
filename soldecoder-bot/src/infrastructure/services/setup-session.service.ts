import { logger } from '@helpers/logger';
import type { Timezone } from '@domain/value-objects/timezone';

export interface SetupSessionData {
  guildId: string;
  userId: string;
  currentStep: number;
  startedAt: number;
  lastMessageId?: string;
  lastChannelId?: string;
  data: {
    globalChannelId?: string;
    walletAddress?: string;
    stopLossPercent?: number;
    timezone?: Timezone;
  };
}

export class SetupSessionService {
  private static instance: SetupSessionService;
  private sessions: Map<string, SetupSessionData> = new Map();
  private readonly SESSION_TIMEOUT = 10 * 60_000;

  private constructor() {
    setInterval(() => this.cleanupExpiredSessions(), 30 * 60_000);
  }

  static getInstance(): SetupSessionService {
    if (!SetupSessionService.instance) {
      SetupSessionService.instance = new SetupSessionService();
    }
    return SetupSessionService.instance;
  }

  private getSessionKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

    createSession(guildId: string, userId: string): SetupSessionData {
    const sessionKey = this.getSessionKey(guildId, userId);

    if (this.sessions.has(sessionKey)) {
      throw new Error('A setup session is already in progress for this user in this server.');
    }

    const session: SetupSessionData = {
      guildId,
      userId,
      currentStep: 1,
      startedAt: Date.now(),
      data: {}
    };

    this.sessions.set(sessionKey, session);
    logger.debug(`Created setup session for user ${userId} in guild ${guildId}`);

    return session;
  }

  restartSession(guildId: string, userId: string): SetupSessionData {
    const sessionKey = this.getSessionKey(guildId, userId);

    this.sessions.delete(sessionKey);

    const session: SetupSessionData = {
      guildId,
      userId,
      currentStep: 1,
      startedAt: Date.now(),
      data: {}
    };

    this.sessions.set(sessionKey, session);
    logger.debug(`Restarted setup session for user ${userId} in guild ${guildId}`);

    return session;
  }

  getSession(guildId: string, userId: string): SetupSessionData | null {
    const sessionKey = this.getSessionKey(guildId, userId);
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return null;
    }

    if (Date.now() - session.startedAt > this.SESSION_TIMEOUT) {
      this.deleteSession(guildId, userId);
      return null;
    }

    return session;
  }

  updateSession(guildId: string, userId: string, updates: Partial<SetupSessionData>): SetupSessionData {
    const sessionKey = this.getSessionKey(guildId, userId);
    const session = this.getSession(guildId, userId);

    if (!session) {
      throw new Error('No active setup session found for this user.');
    }

    const updatedSession = {
      ...session,
      ...updates,
      data: {
        ...session.data,
        ...updates.data
      }
    };

    this.sessions.set(sessionKey, updatedSession);
    logger.debug(`Updated setup session for user ${userId} in guild ${guildId} - Step ${updatedSession.currentStep}`);

    return updatedSession;
  }

      setLastMessageInfo(guildId: string, userId: string, messageId: string, channelId: string): void {
    const sessionKey = this.getSessionKey(guildId, userId);
    const session = this.sessions.get(sessionKey);

    if (session) {
      session.lastMessageId = messageId;
      session.lastChannelId = channelId;
      this.sessions.set(sessionKey, session);
      logger.debug(`Set last message info for session ${userId} in guild ${guildId}: ${messageId}`);
    }
  }

  async sendNewAndDeletePrevious(guildId: string, userId: string, channel: any, embeds: any[], components: any[]): Promise<any> {
    const session = this.getSession(guildId, userId);

    if (session?.lastMessageId && session?.lastChannelId) {
      try {
        const previousMessage = await channel.messages.fetch(session.lastMessageId);
        await previousMessage.delete();
        logger.debug(`Deleted previous setup message ${session.lastMessageId} for session ${userId}`);
      } catch (error) {
        logger.debug(`Could not delete previous message (probably already deleted): ${error}`);
      }
    }

    const newMessage = await channel.send({ embeds, components });

    this.setLastMessageInfo(guildId, userId, newMessage.id, channel.id);

    logger.debug(`Sent new setup message ${newMessage.id} for session ${userId}`);
    return newMessage;
  }

  deleteSession(guildId: string, userId: string): void {
    const sessionKey = this.getSessionKey(guildId, userId);
    const deleted = this.sessions.delete(sessionKey);

    if (deleted) {
      logger.debug(`Deleted setup session for user ${userId} in guild ${guildId}`);
    }
  }

  validateSessionOwner(guildId: string, userId: string, sessionUserId: string): boolean {
    return userId === sessionUserId;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionKey, session] of this.sessions.entries()) {
      if (now - session.startedAt > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionKey);
      }
    }

    expiredSessions.forEach(sessionKey => {
      this.sessions.delete(sessionKey);
      logger.debug(`Cleaned up expired setup session: ${sessionKey}`);
    });

    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired setup sessions`);
    }
  }

  canProceedToStep(session: SetupSessionData, targetStep: number): boolean {
    switch (targetStep) {
      case 1: return true;
      case 2: return !!session.data.globalChannelId;
      case 3: return !!session.data.walletAddress;
      case 4: return !!session.data.timezone;
      case 5: return true;
      default: return false;
    }
  }

  getNextRequiredField(session: SetupSessionData): string | null {
    if (!session.data.globalChannelId) return 'globalChannelId';
    if (!session.data.walletAddress) return 'walletAddress';
    if (!session.data.timezone) return 'timezone';
    return null;
  }

  isSessionComplete(session: SetupSessionData): boolean {
    return !!(
      session.data.globalChannelId &&
      session.data.walletAddress &&
      session.data.timezone
    );
  }
}
