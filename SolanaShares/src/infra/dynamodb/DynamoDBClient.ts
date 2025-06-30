import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { env } from '../../config/environment';

const dynamoClient = new DynamoDBClient({
  region: env.AWS_REGION,
  ...(env.NODE_ENV === 'development' && {
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
  ...(env.NODE_ENV === 'production' && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAMES = {
  users: env.NODE_ENV === 'production' ? 'solana-shares-users' : 'solana-shares-users-dev',
  wallets: env.NODE_ENV === 'production' ? 'solana-shares-wallets' : 'solana-shares-wallets-dev',
  transactions: env.NODE_ENV === 'production' ? 'solana-shares-transactions' : 'solana-shares-transactions-dev',
  snapshots: env.NODE_ENV === 'production' ? 'solana-shares-snapshots' : 'solana-shares-snapshots-dev',
};