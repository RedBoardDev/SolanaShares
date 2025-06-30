import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../domain/ports/repositories';
import { User } from '../../domain/entities/User';

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!user) return null;

    return new User(
      user.userId,
      user.username,
      user.createdAt,
      user.updatedAt
    );
  }

  async save(user: User): Promise<User> {
    const saved = await this.prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        username: user.username,
        updatedAt: new Date(),
      },
      create: {
        userId: user.userId,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

    return new User(
      saved.userId,
      saved.username,
      saved.createdAt,
      saved.updatedAt
    );
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map(user => new User(
      user.userId,
      user.username,
      user.createdAt,
      user.updatedAt
    ));
  }
}