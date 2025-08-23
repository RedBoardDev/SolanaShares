import type { Client, TextChannel, } from 'discord.js';
import { ChannelType, DiscordAPIError } from 'discord.js';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { DynamoGlobalMessageRepository } from '@infrastructure/repositories/dynamo-global-message.repository';
import { parsePositionStatusMessage } from '@application/parsers/position-status.parser';
import { buildGlobalPositionEmbed } from '@presentation/ui/embeds/global-position.embed';
import type { PositionStatus } from '@schemas/position-status.schema';
import { logger } from '@helpers/logger';
import * as crypto from 'crypto';

export class UpdateGlobalPositionDisplayUseCase {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly globalMessageRepo: DynamoGlobalMessageRepository;
  private readonly updateLocks = new Map<string, Promise<void>>();

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.globalMessageRepo = new DynamoGlobalMessageRepository();
  }

  async execute(guildId: string, client: Client): Promise<void> {
    // Check if there's already an update in progress for this guild
    const existingUpdate = this.updateLocks.get(guildId);
    if (existingUpdate) {
      logger.debug('Update already in progress for guild, skipping', { guildId });
      return;
    }

    // Create a new update promise
    const updatePromise = this.performUpdate(guildId, client);
    this.updateLocks.set(guildId, updatePromise);

    try {
      await updatePromise;
    } finally {
      // Always clean up the lock
      this.updateLocks.delete(guildId);
    }
  }

  private async performUpdate(guildId: string, client: Client): Promise<void> {
    const updateStartTime = Date.now();
    logger.debug('Starting global position display update', { guildId, timestamp: new Date().toISOString() });

    try {
      const guildSettings = await this.guildRepo.getByGuildId(guildId);
      if (!guildSettings) {
        logger.debug('Guild settings not found, skipping update', { guildId });
        return;
      }

      if (!guildSettings.positionDisplayEnabled || !guildSettings.globalChannelId) {
        logger.debug('Position display disabled or no global channel, skipping update', {
          guildId,
          positionDisplayEnabled: guildSettings.positionDisplayEnabled,
          globalChannelId: guildSettings.globalChannelId
        });
        return;
      }

      const channels = await this.channelRepo.getByGuildId(guildId);
      if (channels.length === 0) {
        logger.debug('No channel configs found, skipping update', { guildId, channelCount: channels.length });
        return;
      }

      logger.debug('Fetching position statuses', { guildId, channelCount: channels.length });
      const positionStatuses = await this.fetchPositionStatuses(client, channels.map(c => c.channelId));
      logger.debug('Position statuses fetched', {
        guildId,
        positionCount: positionStatuses.length,
        channelIds: channels.map(c => c.channelId),
        successfulChannels: positionStatuses.map(p => p.channelId)
      });

      const channelCreatedAtMap = new Map<string, number>();
      channels.forEach(channel => {
        channelCreatedAtMap.set(channel.channelId, channel.createdAt);
      });

      const positionsByWallet = this.groupPositionsByWallet(positionStatuses, channelCreatedAtMap);
      logger.debug('Positions grouped by wallet', { guildId, walletCount: positionsByWallet.size });

      await this.updateGlobalMessage(client, guildId, guildSettings.globalChannelId, positionsByWallet);

      const totalDuration = Date.now() - updateStartTime;
      logger.debug('Global position display update completed successfully', {
        guildId,
        totalDuration,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const totalDuration = Date.now() - updateStartTime;
      logger.error('Failed to update global position display', error as Error, {
        guildId,
        totalDuration,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async fetchPositionStatuses(client: Client, channelIds: string[]): Promise<{ position: PositionStatus; channelId: string }[]> {
    logger.debug('Starting to fetch position statuses', {
      totalChannels: channelIds.length,
      channelIds
    });

    const fetchTasks = channelIds.map(async (channelId): Promise<{ position: PositionStatus; channelId: string } | null> => {
      try {
        const channel = client.channels.cache.get(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
          logger.debug('Channel not accessible or not text channel', {
            channelId,
            channelType: channel?.type,
            channelName: channel && 'name' in channel ? channel.name : 'unknown'
          });
          return null;
        }

        const textChannel = channel as TextChannel;
        const messages = await textChannel.messages.fetch({ limit: 1 });
        const latestMessage = messages.first();

        if (!latestMessage) {
          logger.debug('No messages found in channel', {
            channelId,
            channelName: textChannel.name
          });
          return null;
        }

        // Skip channels with farmer notification message
        if (latestMessage.content.includes('the farmer is still running')) {
          logger.debug('Skipping channel with farmer notification message', {
            channelId,
            channelName: textChannel.name,
            messageTimestamp: latestMessage.createdAt.toISOString()
          });
          return null;
        }

        const positionStatus = parsePositionStatusMessage(latestMessage.content);
        if (!positionStatus) {
          logger.debug('Failed to parse position status message', {
            channelId,
            channelName: textChannel.name,
            messageContent: latestMessage.content.substring(0, 200) + '...',
            messageTimestamp: latestMessage.createdAt.toISOString()
          });
        }
        return positionStatus ? { position: positionStatus, channelId } : null;
      } catch (error) {
        logger.warn('Error fetching position status from channel', {
          channelId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        });
        return null;
      }
    });

    const results = await Promise.allSettled(fetchTasks);

    const successful = results.filter((result): result is PromiseFulfilledResult<{ position: PositionStatus; channelId: string } | null> =>
      result.status === 'fulfilled' && result.value !== null
    );

    const failed = results.filter(result => result.status === 'rejected');
    const unparseable = results.filter(result =>
      result.status === 'fulfilled' && result.value === null
    );

    logger.debug('Position status fetch results', {
      totalChannels: channelIds.length,
      successful: successful.length,
      failed: failed.length,
      unparseable: unparseable.length,
      successfulChannelIds: successful.map(r => r.value?.channelId).filter(Boolean)
    });

    if (failed.length > 0) {
      logger.warn('Some position status fetches failed', {
        failedCount: failed.length,
        successfulCount: successful.length,
        totalChannels: channelIds.length
      });
    }

    return successful.map(result => result.value!);
  }

  private groupPositionsByWallet(positionData: { position: PositionStatus; channelId: string }[], channelCreatedAtMap: Map<string, number>): Map<string, PositionStatus[]> {
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
      positionsByWallet.get(walletKey)!.push(position);
    }

    const sortedWallets = new Map<string, PositionStatus[]>();
    const walletNames = Array.from(positionsByWallet.keys()).sort();

    for (const walletName of walletNames) {
      sortedWallets.set(walletName, positionsByWallet.get(walletName)!);
    }

    return sortedWallets;
  }



  private async updateGlobalMessage(
    client: Client,
    guildId: string,
    globalChannelId: string,
    positionsByWallet: Map<string, PositionStatus[]>
  ): Promise<void> {
    try {
      const globalChannel = client.channels.cache.get(globalChannelId);
      if (!globalChannel || globalChannel.type !== ChannelType.GuildText) {
        logger.warn('Global channel not found or not a text channel', { guildId, globalChannelId });
        return;
      }

      // Générer un ID random de 4 chiffres pour tracker les mises à jour
	    // Generate a random 5-character alphanumeric string for updateId
	    // Generate a 5-character alphanumeric (letters and digits) ID
	    const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	    const updateId = Array.from({ length: 6 }, () =>
	      ALPHANUMERIC_CHARS.charAt(Math.floor(Math.random() * ALPHANUMERIC_CHARS.length))
	    ).join('');

      const textChannel = globalChannel as TextChannel;
      const embed = buildGlobalPositionEmbed(positionsByWallet, { updateId });

      // Log positions overview for debugging
      const positionsDebugInfo = Array.from(positionsByWallet.entries()).map(([wallet, positions]) => ({
        wallet,
        positionCount: positions.length,
        positions: positions.map(p => ({
          symbol: p.symbolShort,
          pnl: p.pnl.toFixed(4),
          pnlPercentage: p.pnlPercentage.toFixed(2),
          status: p.status
        }))
      }));

      logger.debug('Building global position embed', {
        updateId: updateId,
        guildId,
        walletCount: positionsByWallet.size,
        totalPositions: Array.from(positionsByWallet.values()).reduce((sum, positions) => sum + positions.length, 0),
        positionsOverview: positionsDebugInfo,
        embedHash: this.getEmbedContentHash(embed),
      });

      const existingMessageId = await this.globalMessageRepo.getGlobalMessageId(guildId);

      if (existingMessageId) {
        const updateSuccess = await this.tryUpdateExistingMessage(
          textChannel,
          existingMessageId,
          embed,
          guildId
        );

        if (updateSuccess) {
          logger.debug('Successfully updated existing global message', { guildId, existingMessageId });
          return;
        }
      }

      // Create new message with retry logic
      logger.debug('Creating new global message', {
        guildId,
        channelId: textChannel.id,
        channelName: textChannel.name,
        embedTitle: embed.data?.title || 'No title',
        embedFields: embed.data?.fields?.length || 0
      });

      const newMessage = await this.createNewGlobalMessage(textChannel, embed, guildId);

      logger.debug('New message created, saving to database', {
        guildId,
        newMessageId: newMessage.id,
        messageTimestamp: newMessage.createdAt.toISOString()
      });

      await this.globalMessageRepo.saveGlobalMessage(guildId, newMessage.id);

      logger.debug('Successfully created new global message', {
        guildId,
        newMessageId: newMessage.id,
        channelId: textChannel.id,
        creationTimestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to update global message', error as Error, { guildId, globalChannelId });
      throw error;
    }
  }

    private async tryUpdateExistingMessage(
    textChannel: TextChannel,
    existingMessageId: string,
    embed: any,
    guildId: string
  ): Promise<boolean> {
    logger.debug('Attempting to update existing global message', {
      guildId,
      existingMessageId,
      channelId: textChannel.id,
      channelName: textChannel.name
    });

    try {
      const existingMessage = await this.withRetry(
        () => textChannel.messages.fetch(existingMessageId),
        `fetch message ${existingMessageId}`,
        guildId
      );

      if (!existingMessage) {
        logger.debug('Existing message not found, will create new one', {
          guildId,
          existingMessageId,
          channelId: textChannel.id
        });
        return false;
      }

      // Calculate message age
      const messageAge = Date.now() - existingMessage.createdAt.getTime();
      const messageAgeDays = messageAge / (1000 * 60 * 60 * 24);

      logger.debug('Existing message found, checking if it is latest', {
        guildId,
        existingMessageId,
        messageContent: existingMessage.content.substring(0, 100) + '...',
        messageTimestamp: existingMessage.createdAt.toISOString(),
        messageAgeDays: messageAgeDays.toFixed(2)
      });

      // If message is too old (> 3 days), recreate it
      if (messageAgeDays > 3) {
        logger.warn('Message is too old for reliable editing, will recreate', {
          guildId,
          existingMessageId,
          messageAgeDays: messageAgeDays.toFixed(2),
          messageTimestamp: existingMessage.createdAt.toISOString()
        });

        // Delete old message
        await existingMessage.delete().catch(err => {
          logger.warn('Failed to delete old message', {
            guildId,
            existingMessageId,
            error: err instanceof Error ? err.message : String(err)
          });
        });

        return false;
      }

      // Check if message is still the latest
      const latestMessages = await this.withRetry(
        () => textChannel.messages.fetch({ limit: 1 }),
        'fetch latest messages',
        guildId
      );

      const latestMessage = latestMessages.first();
      const isLatest = latestMessage?.id === existingMessageId;

      logger.debug('Latest message check completed', {
        guildId,
        existingMessageId,
        latestMessageId: latestMessage?.id,
        isLatest,
        latestMessageTimestamp: latestMessage?.createdAt.toISOString()
      });

      if (isLatest) {
        // Store old embed for comparison
        const oldEmbed = existingMessage.embeds[0];
        const oldEmbedHash = oldEmbed ? this.getEmbedContentHash(oldEmbed) : 'empty';
        const newEmbedHash = this.getEmbedContentHash(embed);

        // Log detailed embed comparison
        logger.debug('Embed comparison before edit', {
          guildId,
          existingMessageId,
          oldEmbedHash,
          newEmbedHash,
          contentChanged: oldEmbedHash !== newEmbedHash,
          oldEmbedTitle: oldEmbed?.data?.title || 'No title',
          newEmbedTitle: embed.data?.title || 'No title',
          oldEmbedFields: oldEmbed?.data?.fields?.length || 0,
          newEmbedFields: embed.data?.fields?.length || 0,
          oldEmbedDescription: oldEmbed?.data?.description?.substring(0, 100) || 'No description',
          newEmbedDescription: embed.data?.description?.substring(0, 100) || 'No description'
        });

        // Skip edit if content hasn't changed
        // if (oldEmbedHash === newEmbedHash) {
        //   logger.debug('Embed content unchanged, skipping edit', {
        //     guildId,
        //     existingMessageId,
        //     embedHash: oldEmbedHash
        //   });
        //   return true; // Return true since the content is already up to date
        // }

        // Try to edit the existing message
        logger.debug('Message is latest, attempting to edit', {
          guildId,
          existingMessageId,
          embedTitle: embed.data?.title || 'No title',
          embedFields: embed.data?.fields?.length || 0
        });

        await this.withRetry(
          () => existingMessage.edit({ embeds: [embed] }),
          `edit message ${existingMessageId}`,
          guildId
        );

        // Verify the edit was successful by re-fetching the message
        await this.delay(1000); // Increased delay to ensure Discord has processed the edit

        const verifyMessage = await this.withRetry(
          () => textChannel.messages.fetch(existingMessageId), // Re-fetch message
          `verify edit message ${existingMessageId}`,
          guildId
        );

        const verifiedEmbed = verifyMessage.embeds[0];
        const verifiedEmbedHash = verifiedEmbed ? this.getEmbedContentHash(verifiedEmbed) : 'empty';

        // Check if content actually changed
        const editApplied = verifiedEmbedHash === newEmbedHash;

        if (!editApplied) {
          logger.error('Message edit failed silently - content unchanged', new Error('Silent edit failure'), {
            guildId,
            existingMessageId,
            messageAgeDays: messageAgeDays.toFixed(2),
            oldEmbedHash,
            newEmbedHash,
            verifiedEmbedHash,
            expectedChange: oldEmbedHash !== newEmbedHash,
            actualChange: verifiedEmbedHash !== oldEmbedHash
          });

          // Delete and recreate
          await existingMessage.delete().catch(err => {
            logger.warn('Failed to delete message after failed edit', {
              guildId,
              existingMessageId,
              error: err instanceof Error ? err.message : String(err)
            });
          });

          return false;
        }

        logger.debug('Message edit verified successfully', {
          guildId,
          existingMessageId,
          editTimestamp: new Date().toISOString(),
          oldEmbedHash,
          newEmbedHash,
          verifiedEmbedHash,
          contentChanged: true
        });

        return true;
      } else {
        // Message is not latest, delete it and create new one
        logger.debug('Existing message is not latest, deleting it', {
          guildId,
          existingMessageId,
          latestMessageId: latestMessage?.id,
          reason: 'Message outdated'
        });

        await existingMessage.delete().catch(err => {
          logger.warn('Failed to delete old global message', {
            guildId,
            existingMessageId,
            channelId: textChannel.id,
            error: err instanceof Error ? err.message : String(err)
          });
        });

        logger.debug('Old message deleted successfully', {
          guildId,
          existingMessageId,
          deleteTimestamp: new Date().toISOString()
        });

        return false;
      }

    } catch (error) {
      logger.debug('Failed to update existing message, will create new one', {
        guildId,
        existingMessageId,
        channelId: textChannel.id,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  private async createNewGlobalMessage(textChannel: TextChannel, embed: any, guildId: string): Promise<any> {
    return await this.withRetry(
      () => textChannel.send({ embeds: [embed] }),
      'create new message',
      guildId
    );
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    guildId: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof DiscordAPIError) {
          // Handle specific Discord API errors
          switch (error.code) {
            case 50013: // Missing Permissions
              logger.error(`Discord permission error during ${operationName}`, error, { guildId, attempt });
              throw error; // Don't retry permission errors

            case 50001: // Missing Access
            case 10008: // Unknown Message
            case 10003: // Unknown Channel
              logger.debug(`Discord resource not found during ${operationName}`, { guildId, attempt, code: error.code });
              throw error; // Don't retry not found errors

            case 50035: // Invalid Form Body
              logger.error(`Discord validation error during ${operationName}`, error, { guildId, attempt });
              throw error; // Don't retry validation errors

            case 429: // Rate Limited
              const retryAfter = (error as any).retry_after ? (error as any).retry_after * 1000 : Math.pow(2, attempt) * 1000;
              logger.warn(`Discord rate limit hit during ${operationName}, retrying after ${retryAfter}ms`, {
                guildId,
                attempt,
                retryAfter
              });
              await this.delay(retryAfter);
              continue;

            default:
              // For other errors, use exponential backoff
              if (attempt < maxRetries) {
                const delayMs = Math.pow(2, attempt) * 1000;
                logger.warn(`Discord API error during ${operationName}, retrying after ${delayMs}ms`, {
                  guildId,
                  attempt,
                  code: error.code,
                  message: error.message
                });
                await this.delay(delayMs);
                continue;
              }
              break;
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          // Network timeout
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000;
            logger.warn(`Network timeout during ${operationName}, retrying after ${delayMs}ms`, {
              guildId,
              attempt
            });
            await this.delay(delayMs);
            continue;
          }
        } else {
          // Unknown error
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000;
            logger.warn(`Unknown error during ${operationName}, retrying after ${delayMs}ms`, {
              guildId,
              attempt,
              error: lastError.message
            });
            await this.delay(delayMs);
            continue;
          }
        }

        // If we reach here, we've exhausted all retries
        logger.error(`Failed ${operationName} after ${maxRetries} attempts`, lastError, { guildId });
        throw lastError;
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getEmbedContentHash(embed: any): string {
    // Create a hash of the embed content for reliable comparison
    const contentParts: string[] = [];

    // Include title
    if (embed.data?.title) contentParts.push(embed.data.title);

    // Include description
    if (embed.data?.description) contentParts.push(embed.data.description);

    // Include all field values
    if (embed.data?.fields) {
      for (const field of embed.data.fields) {
        if (field.value) contentParts.push(field.value);
      }
    }

    // Create hash
    const fullContent = contentParts.join('|');
    return crypto.createHash('sha256').update(fullContent).digest('hex').substring(0, 16);
  }
}
