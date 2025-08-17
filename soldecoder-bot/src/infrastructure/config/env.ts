import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { _dirname } from '@helpers/files';
import { logger } from '@helpers/logger';

dotenv.config({ path: path.resolve(_dirname, '../../.env') });

const EnvSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().nonempty(),
  DISCORD_ADMIN_USER_ID: z.string().default(''),

  // AWS
  AWS_REGION: z.string().nonempty(),
  AWS_ACCESS_KEY_ID: z.string().nonempty(),
  AWS_SECRET_ACCESS_KEY: z.string().nonempty(),

  DYNAMODB_CONFIG_TABLE_NAME: z.string().nonempty(),

  // Solana
  SOLANA_RPC_ENDPOINT: z.string().url().default('https://api.mainnet-beta.solana.com'),
  METEORA_PROGRAM_ID: z.string().nonempty(),

  // Solana - Dual keys for parallel processing
  SOLANA_TRACKER_API_KEY_PRIMARY: z.string().nonempty(),
  SOLANA_TRACKER_API_KEY_SECONDARY: z.string().nonempty(),

  // LpAgent API
  LPAGENT_X_AUTH: z.string().nonempty(),

  // Donation
  DONATE_SOLANA_ADDRESS: z.string().nonempty(),
});

const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
  logger.fatal('Invalid or missing environment variables', undefined, { errors: _env.error.format() });
  process.exit(1);
}

export const config = {
  discordToken: _env.data.DISCORD_TOKEN,
  discordAdminUserId: _env.data.DISCORD_ADMIN_USER_ID,
  aws: {
    region: _env.data.AWS_REGION,
    credentials: {
      accessKeyId: _env.data.AWS_ACCESS_KEY_ID,
      secretAccessKey: _env.data.AWS_SECRET_ACCESS_KEY,
    },
    tables: {
      config: _env.data.DYNAMODB_CONFIG_TABLE_NAME,
    },
  },
  solana: {
    rpcEndpoint: _env.data.SOLANA_RPC_ENDPOINT,
    programId: _env.data.METEORA_PROGRAM_ID,
    trackerApiKeys: {
      primary: _env.data.SOLANA_TRACKER_API_KEY_PRIMARY,
      secondary: _env.data.SOLANA_TRACKER_API_KEY_SECONDARY,
    },
  },
  lpagent: {
    xAuth: _env.data.LPAGENT_X_AUTH,
  },
  donate: {
    solanaAddress: _env.data.DONATE_SOLANA_ADDRESS,
  },
} as const;

export type Config = typeof config;
