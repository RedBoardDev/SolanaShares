import type { Client, TextChannel, } from 'discord.js';
import { ChannelType } from 'discord-api-types/v10';
import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
import { DynamoGlobalMessageRepository } from '@infrastructure/repositories/dynamo-global-message.repository';
import { parsePositionStatusMessage } from '@application/parsers/position-status.parser';
import { buildGlobalPositionEmbed } from '@presentation/ui/embeds/global-position.embed';
import type { PositionStatus } from '@schemas/position-status.schema';
import { logger } from '@helpers/logger';

export class UpdateGlobalPositionDisplayUseCase {
  private readonly guildRepo: DynamoGuildSettingsRepository;
  private readonly channelRepo: DynamoChannelConfigRepository;
  private readonly globalMessageRepo: DynamoGlobalMessageRepository;

  constructor() {
    this.guildRepo = new DynamoGuildSettingsRepository();
    this.channelRepo = new DynamoChannelConfigRepository();
    this.globalMessageRepo = new DynamoGlobalMessageRepository();
  }

  async execute(guildId: string, client: Client): Promise<void> {
    try {
      const guildSettings = await this.guildRepo.getByGuildId(guildId);
      if (!guildSettings) {
        return;
      }

      if (!guildSettings.positionDisplayEnabled || !guildSettings.globalChannelId) {
        return;
      }

      const channels = await this.channelRepo.getByGuildId(guildId);
      if (channels.length === 0) {
        return;
      }

      const positionStatuses = await this.fetchPositionStatuses(client, channels.map(c => c.channelId));

      const channelCreatedAtMap = new Map<string, number>();
      channels.forEach(channel => {
        channelCreatedAtMap.set(channel.channelId, channel.createdAt);
      });

      const positionsByWallet = this.groupPositionsByWallet(positionStatuses, channelCreatedAtMap);

      await this.updateGlobalMessage(client, guildId, guildSettings.globalChannelId, positionsByWallet);

    } catch (error) {
      logger.error('Failed to update global position display', error as Error, { guildId });
    }
  }

  private async fetchPositionStatuses(client: Client, channelIds: string[]): Promise<{ position: PositionStatus; channelId: string }[]> {
    const fetchTasks = channelIds.map(async (channelId): Promise<{ position: PositionStatus; channelId: string } | null> => {
      try {
        const channel = client.channels.cache.get(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
          return null;
        }

        const textChannel = channel as TextChannel;
        const messages = await textChannel.messages.fetch({ limit: 1 });
        const latestMessage = messages.first();

        if (!latestMessage) {
          return null;
        }

        const positionStatus = parsePositionStatusMessage(latestMessage.content);
        if (positionStatus) {
          logger.debug('Position status parsed successfully', {
            channelId,
            symbol: positionStatus.symbol,
            wallet: positionStatus.wallet
          });
        }

        return positionStatus ? { position: positionStatus, channelId } : null;
      } catch (error) {
        logger.warn('Failed to fetch message from channel', {
          channelId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    });

    const results = await Promise.allSettled(fetchTasks);

    return results
      .filter((result): result is PromiseFulfilledResult<{ position: PositionStatus; channelId: string }> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
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

      const textChannel = globalChannel as TextChannel;

      const embed = buildGlobalPositionEmbed(positionsByWallet);

      const existingMessageId = await this.globalMessageRepo.getGlobalMessageId(guildId);

      if (existingMessageId) {
        try {
          const existingMessage = await textChannel.messages.fetch(existingMessageId);

          const latestMessages = await textChannel.messages.fetch({ limit: 1 });
          const isLatest = latestMessages.first()?.id === existingMessageId;

          if (isLatest) {
            await existingMessage.edit({ embeds: [embed] });
            return;
          } else {
            await existingMessage.delete().catch(err => {
              logger.warn('Failed to delete old global message', { guildId, existingMessageId, error: err });
            });
          }
        } catch (error) {
          logger.debug('Existing global message not accessible, creating new one', {
            guildId,
            existingMessageId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const newMessage = await textChannel.send({ embeds: [embed] });

      await this.globalMessageRepo.saveGlobalMessage(guildId, newMessage.id);

    } catch (error) {
      logger.error('Failed to update global message', error as Error, { guildId, globalChannelId });
      throw error;
    }
  }
}
