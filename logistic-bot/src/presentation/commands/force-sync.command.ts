import { SlashCommandBuilder, type CommandInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '@helpers/logger';
import { isUserAdmin, replyAdminOnly } from '@helpers/permissions';
import { OnChainSchedulerService } from '@infrastructure/services/onchain-scheduler.service';
import { SyncStatusEmbed } from '@presentation/ui/embeds/sync-status.embed';

export const syncCommand = {
  data: new SlashCommandBuilder()
    .setName('force-sync')
    .setDescription('[ADMIN] Force immediate on-chain sync and show live status'),

  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) {
        await interaction.reply({ content: 'Invalid interaction type', ephemeral: true });
        return;
      }

      if (!isUserAdmin(interaction)) {
        await replyAdminOnly(interaction);
        return;
      }

      const chat = interaction as ChatInputCommandInteraction;
      await chat.deferReply({ ephemeral: true });

      const scheduler = OnChainSchedulerService.getInstance();

      const startIfIdle = () => {
        const current = scheduler.getSchedulerStatus();
        if (!current.onchain.isRunning) {
          scheduler.forceSyncNow().catch((err) => {
            logger.error('Background force sync failed', err as Error);
          });
        }
      };

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      startIfIdle();

      for (;;) {
        await chat.editReply({ content: SyncStatusEmbed.renderLiveStatus(scheduler) });

        const status = scheduler.getSchedulerStatus();
        if (!status.onchain.isRunning && (status.onchain.stage === 'completed' || status.onchain.stage === 'error' || status.onchain.stage === 'idle')) {
          break;
        }

        await sleep(2000);
      }

      const finalMessage = await SyncStatusEmbed.renderFinalStatus(scheduler);
      await chat.editReply({ content: finalMessage });

    } catch (error) {
      logger.error('Error executing force-sync command', error as Error);
      try {
        if (interaction.isRepliable()) {
          if ((interaction as ChatInputCommandInteraction).deferred || interaction.replied) {
            await (interaction as ChatInputCommandInteraction).editReply({ content: '❌ An error occurred while processing the force-sync command.' });
          } else {
            await interaction.reply({ content: '❌ An error occurred while processing the force-sync command.', ephemeral: true });
          }
        }
      } catch {}
    }
  },
};
