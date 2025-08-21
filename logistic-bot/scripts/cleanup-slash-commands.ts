import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Client } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in environment variables');
  process.exit(1);
}

// TypeScript assertion after validation
const token: string = DISCORD_TOKEN;

// Use numeric value for Guilds intent to avoid import issues
const DISCORD_INTENTS = [1]; // GatewayIntentBits.Guilds = 1

async function cleanupAllSlashCommands() {
  console.log('🚀 Starting complete slash commands cleanup...');

  const client = new Client({ intents: DISCORD_INTENTS });
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    // Login to Discord
    await client.login(token);
    console.log('✅ Bot connected to Discord');

    // Wait for client to be ready
    await new Promise<void>((resolve) => {
      client.once('ready', () => {
        console.log(`🤖 Logged in as ${client.user?.tag}`);
        resolve();
      });
    });

    const app = await client.application?.fetch();
    const clientId = app?.id ?? client.user?.id;

    if (!clientId) {
      throw new Error('Unable to resolve application clientId');
    }

    console.log(`🆔 Client ID: ${clientId}`);

    // 1. CLEANUP GLOBAL COMMANDS
    console.log('\n🔍 Checking GLOBAL commands...');
    try {
      const globalCommands = await rest.get(Routes.applicationCommands(clientId)) as any[];
      console.log(`📋 Found ${globalCommands.length} global commands`);

      if (globalCommands.length > 0) {
        for (const command of globalCommands) {
          await rest.delete(Routes.applicationCommand(clientId, command.id));
          console.log(`🗑️  Deleted global command: ${command.name} (${command.id})`);
        }
        console.log(`✅ Deleted ${globalCommands.length} global commands`);
      } else {
        console.log('✅ No global commands to delete');
      }
    } catch (error) {
      console.error('❌ Error cleaning global commands:', error);
    }

    // 2. CLEANUP GUILD-SPECIFIC COMMANDS
    console.log('\n🔍 Checking GUILD-specific commands...');
    const guilds = client.guilds.cache;
    console.log(`🏰 Bot is in ${guilds.size} guilds`);

    let totalGuildCommands = 0;

    for (const [guildId, guild] of guilds) {
      try {
        console.log(`\n🏰 Checking guild: ${guild.name} (${guildId})`);
        const guildCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId)) as any[];

        if (guildCommands.length > 0) {
          console.log(`📋 Found ${guildCommands.length} commands in ${guild.name}`);

          for (const command of guildCommands) {
            await rest.delete(Routes.applicationGuildCommand(clientId, guildId, command.id));
            console.log(`🗑️  Deleted guild command: ${command.name} (${command.id}) from ${guild.name}`);
            totalGuildCommands++;
          }
        } else {
          console.log(`✅ No commands in ${guild.name}`);
        }
      } catch (guildError) {
        console.error(`❌ Failed to clean commands for guild ${guild.name}:`, guildError);
      }
    }

    console.log(`\n✅ Deleted ${totalGuildCommands} total guild commands across ${guilds.size} guilds`);

    // 3. FINAL VERIFICATION
    console.log('\n🔍 Final verification...');

    try {
      const remainingGlobal = await rest.get(Routes.applicationCommands(clientId)) as any[];
      console.log(`📋 Remaining global commands: ${remainingGlobal.length}`);

      let remainingGuildTotal = 0;
      for (const [guildId] of guilds) {
        try {
          const remainingGuild = await rest.get(Routes.applicationGuildCommands(clientId, guildId)) as any[];
          remainingGuildTotal += remainingGuild.length;
        } catch {
          // Ignore errors for verification
        }
      }
      console.log(`📋 Remaining guild commands: ${remainingGuildTotal}`);

      if (remainingGlobal.length === 0 && remainingGuildTotal === 0) {
        console.log('\n🎉 SUCCESS: All slash commands have been completely removed!');
        console.log('⏰ Global commands may take up to 1 hour to disappear from Discord UI');
        console.log('🚀 Guild commands should disappear immediately');
      } else {
        console.log('\n⚠️  Some commands may still remain. Check the output above.');
      }

    } catch (verifyError) {
      console.error('❌ Error during verification:', verifyError);
    }

  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    process.exit(1);
  } finally {
    await client.destroy();
    console.log('\n👋 Bot disconnected');
    process.exit(0);
  }
}

// Run the cleanup
cleanupAllSlashCommands().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
