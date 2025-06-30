import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './DynamoDBClient';
import { UserRepository } from '../../domain/ports/repositories';
import { User } from '../../domain/entities/User';

export class DynamoUserRepository implements UserRepository {
  private tableName = TABLE_NAMES.users;

  async findByUserId(userId: string): Promise<User | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { userId },
    });

    const response = await docClient.send(command);
    
    if (!response.Item) return null;

    return new User(
      response.Item.userId,
      response.Item.username,
      new Date(response.Item.createdAt),
      new Date(response.Item.updatedAt)
    );
  }

  async save(user: User): Promise<User> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId: user.userId,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });

    await docClient.send(command);
    return user;
  }

  async findAll(): Promise<User[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    const response = await docClient.send(command);
    
    if (!response.Items) return [];

    return response.Items.map(item => new User(
      item.userId,
      item.username,
      new Date(item.createdAt),
      new Date(item.updatedAt)
    ));
  }
}