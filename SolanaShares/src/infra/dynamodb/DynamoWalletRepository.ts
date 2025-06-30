import { PutCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './DynamoDBClient';
import { WalletRepository } from '../../domain/ports/repositories';
import { Wallet } from '../../domain/entities/Wallet';

export class DynamoWalletRepository implements WalletRepository {
  private tableName = TABLE_NAMES.wallets;

  async findByUserId(userId: string): Promise<Wallet | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { userId },
    });

    const response = await docClient.send(command);
    
    if (!response.Item) return null;

    return new Wallet(
      response.Item.userId,
      response.Item.walletAddress,
      {
        cipherSeed: response.Item.cipherSeed,
        cipherDataKey: response.Item.cipherDataKey,
        nonce: response.Item.nonce,
      },
      new Date(response.Item.createdAt),
      new Date(response.Item.updatedAt)
    );
  }

  async findByAddress(address: string): Promise<Wallet | null> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'walletAddress-index',
      KeyConditionExpression: 'walletAddress = :address',
      ExpressionAttributeValues: {
        ':address': address,
      },
    });

    const response = await docClient.send(command);
    
    if (!response.Items || response.Items.length === 0) return null;

    const item = response.Items[0];
    return new Wallet(
      item.userId,
      item.walletAddress,
      {
        cipherSeed: item.cipherSeed,
        cipherDataKey: item.cipherDataKey,
        nonce: item.nonce,
      },
      new Date(item.createdAt),
      new Date(item.updatedAt)
    );
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId: wallet.userId,
        walletAddress: wallet.walletAddress,
        cipherSeed: wallet.encryptedSeed.cipherSeed,
        cipherDataKey: wallet.encryptedSeed.cipherDataKey,
        nonce: wallet.encryptedSeed.nonce,
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      },
    });

    await docClient.send(command);
    return wallet;
  }

  async findAll(): Promise<Wallet[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    const response = await docClient.send(command);
    
    if (!response.Items) return [];

    return response.Items.map(item => new Wallet(
      item.userId,
      item.walletAddress,
      {
        cipherSeed: item.cipherSeed,
        cipherDataKey: item.cipherDataKey,
        nonce: item.nonce,
      },
      new Date(item.createdAt),
      new Date(item.updatedAt)
    ));
  }
}