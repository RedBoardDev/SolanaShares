import 'reflect-metadata';
import { container } from 'tsyringe';

// Repositories
import { DynamoUserRepository } from './dynamodb/DynamoUserRepository';
import { DynamoWalletRepository } from './dynamodb/DynamoWalletRepository';

// Services
import { PinoLogger } from './logger/PinoLogger';
import { KMSEncryptionService } from './kms/KMSEncryptionService';
import { MockEncryptionService } from './kms/MockEncryptionService';
import { SolanaFacade } from './solana/SolanaFacade';
import { env } from '../config/environment';

// Use Cases
import { CreateWalletUseCase } from '../application/use-cases/CreateWalletUseCase';
import { ExportWalletUseCase } from '../application/use-cases/ExportWalletUseCase';

export function setupDependencyContainer(): void {
  // Repositories
  container.registerSingleton('UserRepository', DynamoUserRepository);
  container.registerSingleton('WalletRepository', DynamoWalletRepository);

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
  container.registerSingleton('ExportWalletUseCase', ExportWalletUseCase);
}

export { container };