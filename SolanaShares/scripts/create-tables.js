const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

const tables = [
  {
    TableName: 'solana-shares-users-dev',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'solana-shares-wallets-dev',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'walletAddress', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'walletAddress-index',
        KeySchema: [
          { AttributeName: 'walletAddress', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'solana-shares-transactions-dev',
    KeySchema: [
      { AttributeName: 'txId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'txId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'solana-shares-snapshots-dev',
    KeySchema: [
      { AttributeName: 'snapshotId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'snapshotId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function createTables() {
  for (const table of tables) {
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`✅ Created table: ${table.TableName}`);
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log(`⚠️  Table already exists: ${table.TableName}`);
      } else {
        console.error(`❌ Error creating table ${table.TableName}:`, error);
      }
    }
  }
}

createTables()
  .then(() => console.log('✅ All tables created successfully'))
  .catch(console.error);