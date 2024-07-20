import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '@infrastructure/config/env';

const ddb = new DynamoDBClient({
  region: config.aws.region,
  credentials: config.aws.credentials,
});

export const docClient = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});
