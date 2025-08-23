import type { Message, TextChannel } from 'discord.js';
import type { MessageRule } from '@domain/interfaces/message-rule.interface';
import { logger } from '@helpers/logger';
import { ChannelType } from 'discord-api-types/v10';
import { parseMetlexMessage } from '@application/parsers/metlex-message.parser';
// import { PositionFetcher } from '@infrastructure/services/position-fetcher.service';
// import { aggregatePositions, computePositions } from '@infrastructure/helpers/compute-positions';
import { getPreviousMessage } from '@infrastructure/helpers/get-previous-message';
import type { FinalPositionData } from '@schemas/final-position.schema';
import type { TriggerData } from '@schemas/trigger-message.schema';
import { parseTriggerMessage } from '@application/parsers/trigger-message.parser';
import { safePin } from '@helpers/safe-pin';
import { buildPositionImage } from '@presentation/ui/position/build-position-image';
import { buildPositionMessage } from '@presentation/ui/position/build-position-message';
import { buildTriggeredMessage } from '@presentation/ui/position/build-triggered-message';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import type { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { LpAgentService } from '@infrastructure/services/lpagent.service';
import { SolanaWeb3Service } from '@infrastructure/services/solanaweb3.service';
import { mapLpAgentToFinalPosition } from '@application/mappers/lpagent-to-final-position.mapper';

interface PreparedContent {
  contentBody: string;
  content: string;
  files: { attachment: Buffer; name: string }[] | undefined;
  triggerData: TriggerData | null;
}

interface MentionData {
  mention: string | null;
  allowedMentions: { users?: string[]; roles?: string[] } | undefined;
}

export class ClosedMessageRule implements MessageRule {
  public readonly id = 'closed-message';
  public readonly name = 'Closed Message Handler';
  public readonly exclusive = true;

  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly lpAgentService: LpAgentService;
  private readonly solanaService: SolanaWeb3Service;

  constructor() {
    this.channelRepo = new DynamoChannelConfigRepository();
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.lpAgentService = LpAgentService.getInstance();
    this.solanaService = SolanaWeb3Service.getInstance();
  }

  public matches(message: Message): boolean {
    return (
      message.guildId !== null &&
      message.channel.type === ChannelType.GuildText &&
      message.content.trim().startsWith('🟨Closed')
    );
  }

  public async execute(message: Message): Promise<void> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Step 1: Parse Metlex message to get wallet prefix and position hashes
      const data = parseMetlexMessage(message.content);
      if (!data) {
        logger.debug('No data extracted from message, returning');
        return;
      }

      const { walletPrefix, positionHashes } = data;
      logger.debug('Metlex data extracted', {
        walletPrefix,
        hashCount: positionHashes.length,
      });

      const channelConfig = await this.channelRepo.getByChannelId(message.channelId);
      if (!channelConfig) {
        logger.debug('Channel not configured, skipping', { channelId: message.channelId });
        return;
      }

      if (!channelConfig.notifyOnClose) {
        logger.debug('Notifications disabled for this channel', { channelId: message.channelId });
        return;
      }

      // Step 2: Extract transaction signatures from message content and get wallet address via signer
      const transactionSignatures = this.extractTransactionSignatures(message.content);
      if (transactionSignatures.length === 0) {
        logger.error('No transaction signatures found in message content');
        throw new Error('No transaction signatures found to determine wallet address');
      }

      let walletAddress: string;
      try {
        // Use the first transaction signature to get the signer (wallet owner)
        const firstSignature = transactionSignatures[0];
        walletAddress = await this.solanaService.getTransactionSigner(firstSignature);

        logger.debug('Wallet address extracted from transaction signer', {
          signature: firstSignature,
          walletAddress,
          walletPrefix,
        });
      } catch (error) {
        logger.error('Failed to extract wallet address from transaction signer', error as Error, {
          signature: transactionSignatures[0],
        });
        throw new Error(
          `Failed to get wallet address from transaction: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Step 3: Get historical positions from LpAgent API (page 1, limit 1 for latest)
      let aggregatedPosition: FinalPositionData;

      try {
        const historicalResponse = await this.lpAgentService.getHistoricalPositions(walletAddress, 1, 1);

        if (!historicalResponse.data.data || historicalResponse.data.data.length === 0) {
          logger.debug('No historical positions found for wallet', { wallet: walletAddress });
          return;
        }

        // Step 4: Map LpAgent response to FinalPositionData using our mapper
        const latestPosition = historicalResponse.data.data[0];
        aggregatedPosition = mapLpAgentToFinalPosition(latestPosition);

        logger.debug('Position data mapped successfully', {
          positionAddress: aggregatedPosition.metadata.address,
          pnlPercentage: aggregatedPosition.performance.pnl_percentage,
        });
      } catch (error) {
        logger.error('Failed to fetch or map historical position data', error as Error);

        // Fallback to old method if LpAgent fails
        logger.debug('Falling back to old position fetching method');

        // FALLBACK: Keep old method as backup (commented for now)
        // const fetcher = PositionFetcher.getInstance();
        // const positions = await fetcher.fetchPositions(positionHashes);
        // const computedPositions = await computePositions(positions);
        // aggregatedPosition = aggregatePositions(computedPositions);

        // For now, just return on error
        throw error;
      }

      // Step 5: Check PnL threshold
      if (Math.abs(aggregatedPosition.performance.pnl_percentage) < channelConfig.threshold) {
        logger.debug('PnL below threshold, not sending message', {
          pnl: aggregatedPosition.performance.pnl_percentage,
          threshold: channelConfig.threshold,
        });
        return;
      }

      // Step 6: Send the message as before
      const mentionData = this.prepareMention(channelConfig);
      const preparedContent = await this.prepareContent(
        message,
        aggregatedPosition,
        mentionData.mention,
        channelConfig,
      );

      await this.sendPositionMessage(message, preparedContent, mentionData.allowedMentions, channelConfig);

      if (preparedContent.triggerData && message.guildId) {
        await this.sendToGlobalChannelIfEnabled(message, preparedContent.contentBody, message.guildId);
      }
    } catch (err) {
      logger.error('closed-message rule failed', err instanceof Error ? err : new Error(String(err)));

      if (message.channel?.isSendable()) {
        let errorMessage = '❌ **Error**: Failed to process closed position message.';

        if (err instanceof Error) {
          if (err.message.includes('Missing permission: Manage Messages')) {
            errorMessage = '❌ **Permission Error**: Missing "Manage Messages" permission to pin notifications.';
          } else if (err.message.includes('Transaction') && err.message.includes('not found')) {
            errorMessage = '❌ **Transaction Error**: Position transaction not yet finalized on Solana.';
          } else if (err.message.includes('RPC error')) {
            errorMessage = '❌ **Network Error**: Unable to fetch position data from Solana.';
          } else if (err.message.includes('LpAgent')) {
            errorMessage = '❌ **API Error**: Unable to fetch position data from LpAgent API.';
          }
        }

        await message.channel.send(errorMessage);
      }
    }
  }

  /**
   * Extracts Solana transaction signatures from message content
   * Solana signatures are base58 encoded strings of 87-88 characters
   */
  private extractTransactionSignatures(content: string): string[] {
    // Solana signatures are base58 strings, typically 87-88 characters long
    // Base58 characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const base58Regex = /\b[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{87,88}\b/g;
    const signatures: string[] = [];
    let match: RegExpExecArray | null;

    match = base58Regex.exec(content);
    while (match !== null) {
      signatures.push(match[0]);
      match = base58Regex.exec(content);
    }

    return signatures;
  }

  private prepareMention(channelConfig: ChannelConfigEntity): MentionData {
    let mention: string | null = null;
    let allowedMentions: { users?: string[]; roles?: string[] } | undefined;

    if (channelConfig.tagId && channelConfig.tagType !== 'NONE') {
      logger.debug('Setting up mentions', { tagType: channelConfig.tagType, tagId: channelConfig.tagId });
      if (channelConfig.tagType === 'USER') {
        mention = `<@${channelConfig.tagId}> `;
        allowedMentions = { users: [channelConfig.tagId] };
      } else if (channelConfig.tagType === 'ROLE') {
        mention = `<@&${channelConfig.tagId}> `;
        allowedMentions = { roles: [channelConfig.tagId] };
      }
    }

    return { mention, allowedMentions };
  }

  private async prepareContent(
    message: Message,
    aggregatedPosition: FinalPositionData,
    mention: string | null,
    channelConfig: ChannelConfigEntity,
  ): Promise<PreparedContent> {
    let contentBody: string;
    let triggerData: TriggerData | null = null;

    const previousMessage = await getPreviousMessage(message);

    triggerData = previousMessage ? parseTriggerMessage(previousMessage.content) : null;

    if (triggerData) {
      logger.debug('Trigger detected', { type: triggerData.type });
      contentBody = buildTriggeredMessage(aggregatedPosition, triggerData);
    } else {
      logger.debug('No trigger, building standard message');
      contentBody = buildPositionMessage(aggregatedPosition);
    }

    const content = mention ? `${contentBody} ||${mention}||` : contentBody;
    logger.debug('Message content prepared', { hasImage: channelConfig.image, willPin: channelConfig.pin });

    const files = channelConfig.image
      ? [
          {
            attachment: await buildPositionImage(aggregatedPosition, triggerData ?? undefined),
            name: `${aggregatedPosition.metadata.address}.png`,
          },
        ]
      : undefined;

    return { contentBody, content, files, triggerData };
  }

  private async sendPositionMessage(
    message: Message,
    preparedContent: PreparedContent,
    allowedMentions: { users?: string[]; roles?: string[] } | undefined,
    channelConfig: ChannelConfigEntity,
  ): Promise<void> {
    const channel = message.channel as TextChannel;

    let sent;
    try {
      sent = await message.reply({
        content: preparedContent.content,
        ...(preparedContent.files && { files: preparedContent.files }),
        allowedMentions,
      });
    } catch (error) {
      logger.debug('Reply failed, trying channel.send', { error: error instanceof Error ? error.message : error });
      sent = await channel.send({
        content: preparedContent.content,
        ...(preparedContent.files && { files: preparedContent.files }),
        allowedMentions,
      });
    }

    if (channelConfig.pin) {
      try {
        await safePin(sent);
      } catch (pinError) {
        logger.warn('Failed to pin message', { error: pinError instanceof Error ? pinError.message : pinError });
      }
    }
  }

  private async sendToGlobalChannelIfEnabled(
    originalMessage: Message,
    contentBody: string,
    guildId: string,
  ): Promise<void> {
    try {
      const guildSettings = await this.guildRepo.getByGuildId(guildId);
      if (!guildSettings) {
        logger.debug('Guild settings not found, skipping global channel', { guildId });
        return;
      }

      if (!guildSettings.forwardTpSl || !guildSettings.globalChannelId) return;

      const globalChannel = originalMessage.guild?.channels.cache.get(guildSettings.globalChannelId);
      if (!globalChannel || !globalChannel.isSendable()) {
        logger.warn('Global channel not found or not sendable', {
          guildId,
          globalChannelId: guildSettings.globalChannelId,
        });
        return;
      }

      await globalChannel.send({
        content: contentBody,
      });
    } catch (error) {
      logger.error('Failed to send message to global channel', error as Error, { guildId });
    }
  }
}
