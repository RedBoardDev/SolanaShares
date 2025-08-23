import type { Client, TextChannel, Message } from 'discord.js';
import { ChannelType, DiscordAPIError, type EmbedBuilder } from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { DynamoGlobalMessageRepository } from '@infrastructure/repositories/dynamo-global-message.repository';
import { DiscordRateLimiterService } from '@infrastructure/services/discord-rate-limiter.service';
import { parsePositionStatusMessage } from '@application/parsers/position-status.parser';
import { buildGlobalPositionEmbed } from '@presentation/ui/embeds/global-position.embed';
import type { PositionStatus } from '@schemas/position-status.schema';
import { logger } from '@helpers/logger';
import * as crypto from 'node:crypto';

/**
 * Use case for updating global position displays across multiple guilds.
 * Designed for efficient, scalable updates (50+ guilds) while respecting Discord rate limits.
 */
export class UpdateGlobalPositionDisplayUseCase {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly globalMessageRepo: DynamoGlobalMessageRepository;
  private readonly rateLimiter: DiscordRateLimiterService;
  private readonly updateLocks = new Map<string, Promise<void>>();

  private readonly MESSAGE_MAX_AGE_DAYS = 7;
  private readonly FARMER_MESSAGE_PATTERN = 'the farmer is still running';
  private readonly BATCH_SIZE = 10;

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.globalMessageRepo = new DynamoGlobalMessageRepository();
    this.rateLimiter = DiscordRateLimiterService.getInstance();
  }

  async execute(guildId: string, client: Client): Promise<void> {
    const existingUpdate = this.updateLocks.get(guildId);
    if (existingUpdate) {
      return existingUpdate;
    }

    const updatePromise = this.performUpdate(guildId, client)
      .catch((error) => {
        logger.error('Failed to update global position display', error as Error, { guildId });
      })
      .finally(() => {
        this.updateLocks.delete(guildId);
      });

    this.updateLocks.set(guildId, updatePromise);
    return updatePromise;
  }

  private async performUpdate(guildId: string, client: Client): Promise<void> {
    const startTime = Date.now();

    const guildSettings = await this.guildRepo.getByGuildId(guildId);
    if (!guildSettings?.positionDisplayEnabled || !guildSettings?.globalChannelId) {
      return;
    }

    const channels = await this.channelRepo.getByGuildId(guildId);
    if (channels.length === 0) {
      return;
    }

    const positionStatuses = await this.fetchPositionStatuses(
      client,
      channels.map((c) => c.channelId),
    );

    if (positionStatuses.length === 0) {
      return;
    }

    const channelCreatedAtMap = new Map(channels.map((c) => [c.channelId, c.createdAt]));
    const positionsByWallet = this.groupPositionsByWallet(positionStatuses, channelCreatedAtMap);

    await this.updateGlobalMessage(client, guildId, guildSettings.globalChannelId, positionsByWallet);

    const duration = Date.now() - startTime;
    if (duration > 5000) {
      logger.warn('Slow position update detected', { guildId, duration });
    }
  }

  private async fetchPositionStatuses(
    client: Client,
    channelIds: string[],
  ): Promise<{ position: PositionStatus; channelId: string }[]> {
    const results: { position: PositionStatus; channelId: string }[] = [];

    for (let i = 0; i < channelIds.length; i += this.BATCH_SIZE) {
      const batch = channelIds.slice(i, i + this.BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((channelId) => this.fetchSingleChannelPosition(client, channelId)),
      );

      results.push(...batchResults.filter((r): r is { position: PositionStatus; channelId: string } => r !== null));
    }

    return results;
  }

  private async fetchSingleChannelPosition(
    client: Client,
    channelId: string,
  ): Promise<{ position: PositionStatus; channelId: string } | null> {
    try {
      const channel = client.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return null;
      }

      const textChannel = channel as TextChannel;

      const messages = await this.rateLimiter.fetchChannel(channelId, () => textChannel.messages.fetch({ limit: 1 }));

      const latestMessage = messages.first();
      if (!latestMessage || latestMessage.content.includes(this.FARMER_MESSAGE_PATTERN)) {
        return null;
      }

      const positionStatus = parsePositionStatusMessage(latestMessage.content);
      return positionStatus ? { position: positionStatus, channelId } : null;
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code !== 10003) {
        logger.debug('Error fetching channel position', {
          channelId,
          error: error.message,
          code: error.code,
        });
      }
      return null;
    }
  }

  private groupPositionsByWallet(
    positionData: { position: PositionStatus; channelId: string }[],
    channelCreatedAtMap: Map<string, number>,
  ): Map<string, PositionStatus[]> {
    const sortedPositionData = positionData.sort((a, b) => {
      const createdAtA = channelCreatedAtMap.get(a.channelId) || Date.now();
      const createdAtB = channelCreatedAtMap.get(b.channelId) || Date.now();
      return createdAtA - createdAtB;
    });

    const positionsByWallet = new Map<string, PositionStatus[]>();
    for (const { position } of sortedPositionData) {
      const walletKey = position.walletName;
      if (!positionsByWallet.has(walletKey)) {
        positionsByWallet.set(walletKey, []);
      }
      const positions = positionsByWallet.get(walletKey);
      if (positions) {
        positions.push(position);
      }
    }

    return positionsByWallet;
  }

  private async updateGlobalMessage(
    client: Client,
    guildId: string,
    globalChannelId: string,
    positionsByWallet: Map<string, PositionStatus[]>,
  ): Promise<void> {
    const globalChannel = client.channels.cache.get(globalChannelId);
    if (!globalChannel || globalChannel.type !== ChannelType.GuildText) {
      throw new Error(`Global channel ${globalChannelId} not found or not accessible`);
    }

    const textChannel = globalChannel as TextChannel;
    const updateId = crypto.randomBytes(3).toString('hex');
    const embed = buildGlobalPositionEmbed(positionsByWallet, { updateId });

    const existingMessageId = await this.globalMessageRepo.getGlobalMessageId(guildId);

    if (existingMessageId) {
      const updated = await this.tryUpdateExistingMessage(textChannel, existingMessageId, embed, guildId);

      if (updated) {
        return;
      }
    }

    const newMessage = await this.createNewMessage(textChannel, embed);
    await this.globalMessageRepo.saveGlobalMessage(guildId, newMessage.id);
  }

  private async tryUpdateExistingMessage(
    textChannel: TextChannel,
    messageId: string,
    embed: EmbedBuilder,
    guildId: string,
  ): Promise<boolean> {
    try {
      const existingMessage = await this.rateLimiter.fetchChannel(textChannel.id, () =>
        textChannel.messages.fetch(messageId),
      );

      if (!existingMessage) {
        return false;
      }

      const messageAgeDays = (Date.now() - existingMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (messageAgeDays > this.MESSAGE_MAX_AGE_DAYS) {
        await this.deleteMessageSafely(existingMessage);
        return false;
      }

      const latestMessages = await this.rateLimiter.fetchChannel(textChannel.id, () =>
        textChannel.messages.fetch({ limit: 1 }),
      );

      if (latestMessages.first()?.id !== messageId) {
        await this.deleteMessageSafely(existingMessage);
        return false;
      }

      // Éditer le message
      await this.rateLimiter.editMessage(messageId, () => existingMessage.edit({ embeds: [embed] }));

      return true;
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        switch (error.code) {
          case 10008: // Unknown Message
          case 10003: // Unknown Channel
            return false;
          case 50013: // Missing Permissions
            throw error;
          default:
            logger.debug('Discord API error during message update', {
              guildId,
              messageId,
              code: error.code,
            });
            return false;
        }
      }
      throw error;
    }
  }

  /**
   * Crée un nouveau message
   */
  private async createNewMessage(textChannel: TextChannel, embed: EmbedBuilder): Promise<Message> {
    return await this.rateLimiter.sendMessage(textChannel.id, () => textChannel.send({ embeds: [embed] }));
  }

  /**
   * Supprime un message de manière sécurisée
   */
  private async deleteMessageSafely(message: Message): Promise<void> {
    try {
      await this.rateLimiter.deleteMessage(message.id, () => message.delete());
    } catch (error) {
      // Ignorer les erreurs de suppression
      logger.debug('Failed to delete message', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
