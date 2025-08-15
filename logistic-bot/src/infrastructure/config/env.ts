import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { _dirname } from '@helpers/files';
import { logger } from '@helpers/logger';

dotenv.config({ path: path.resolve(_dirname, '../../.env') });

const EnvSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().nonempty(),

  // AWS
  AWS_REGION: z.string().nonempty(),
  AWS_ACCESS_KEY_ID: z.string().nonempty(),
  AWS_SECRET_ACCESS_KEY: z.string().nonempty(),

  DYNAMODB_CONFIG_TABLE_NAME: z.string().nonempty(),

  // Solana
  SOLANA_RPC_ENDPOINT: z.string().url().default('https://api.mainnet-beta.solana.com'),

  WALLET_ADDRESS: z.string().nonempty(),
  PHASE_START_DATE: z.string(),
  PHASE_MONTH_DURATION: z.string(),
  DISCORD_FARMER_ROLE_ID: z.string().nonempty(),
  FARMER_MIN_SOL_AMOUNT: z.string().nonempty(),

  // LpAgent API
  LPAGENT_X_AUTH: z.string().nonempty(),
});

const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
  logger.fatal('Invalid or missing environment variables', undefined, { errors: _env.error.format() });
  process.exit(1);
}

export const config = {
  discordToken: _env.data.DISCORD_TOKEN,
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
    phase: {
      wallet: _env.data.WALLET_ADDRESS,
      startDate: _env.data.PHASE_START_DATE,
      monthDuration: _env.data.PHASE_MONTH_DURATION,
      farmer: {
        minSolAmount: _env.data.FARMER_MIN_SOL_AMOUNT,
        discordRoleId: _env.data.DISCORD_FARMER_ROLE_ID,
      },
    },
  },
  lpagent: {
    xAuth: _env.data.LPAGENT_X_AUTH,
  },
} as const;

export type Config = typeof config;
