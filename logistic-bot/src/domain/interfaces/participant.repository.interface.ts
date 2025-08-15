import type { ParticipantEntity } from '@domain/entities/participant.entity';

export interface ParticipantRepository {
  /* Get all participants */
  getAll(): Promise<ParticipantEntity[]>;

  /* Get a participant by their wallet address */
  findByWalletAddress(walletAddress: string): Promise<ParticipantEntity | null>;

  /* Get a participant by their Discord user */
  findByDiscordUser(discordUser: string): Promise<ParticipantEntity | null>;

  /* Create or update a participant */
  save(participant: ParticipantEntity): Promise<void>;

  /* Update an existing participant */
  update(participant: ParticipantEntity): Promise<void>;

  /* Delete a participant */
  delete(userId: string): Promise<void>;

  /* Get participants with transactions */
  getParticipantsWithTransactions(): Promise<ParticipantEntity[]>;

  /* Get active participants with transactions */
  getActiveParticipantsWithTransactions(): Promise<ParticipantEntity[]>;

  /* Get global statistics */
  getGlobalStats(): Promise<{ totalInvested: number; participantCount: number; activeParticipants: number }>;
}
