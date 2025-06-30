import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

// Repositories
import { PrismaUserRepository } from './prisma/PrismaUserRepository';
import { PrismaWalletRepository } from './prisma/PrismaWalletRepository';

// Services
import { PinoLogger } from './logger/PinoLogger';
import { KMSEncryptionService } from './kms/KMSEncryptionService';
import { MockEncryptionService } from './kms/MockEncryptionService';
import { SolanaFacade } from './solana/SolanaFacade';
import { env } from '../config/environment';

// Use Cases
import { CreateWalletUseCase } from '../application/use-cases/CreateWalletUseCase';

export function setupDependencyContainer(): void {
  // Database
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
  container.registerInstance('PrismaClient', prisma);

  // Repositories - Register as factories to inject PrismaClient
  container.register('UserRepository', {
    useFactory: () => new PrismaUserRepository(prisma),
  });
  
  container.register('WalletRepository', {
    useFactory: () => new PrismaWalletRepository(prisma),
  });

  // Services
  container.registerSingleton('LoggerService', PinoLogger);
  
  // Use mock encryption service in development, real KMS in production
  if (env.NODE_ENV === 'development' && env.KMS_CMK_USER_KEY_ID.startsWith('mock-')) {
    container.registerSingleton('EncryptionService', MockEncryptionService);
  } else {
    container.registerSingleton('EncryptionService', KMSEncryptionService);
  }
  
  container.registerSingleton('WalletService', SolanaFacade);
  container.registerSingleton('SolanaService', SolanaFacade);

  // Use Cases
  container.registerSingleton('CreateWalletUseCase', CreateWalletUseCase);
}

export { container };