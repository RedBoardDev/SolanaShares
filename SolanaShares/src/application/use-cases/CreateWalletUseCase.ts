import { injectable, inject } from 'tsyringe';
import { UserRepository, WalletRepository } from '../../domain/ports/repositories';
import { WalletService, EncryptionService, LoggerService } from '../../domain/ports/services';
import { User } from '../../domain/entities/User';
import { Wallet } from '../../domain/entities/Wallet';
import { env } from '../../config/environment';

export interface CreateWalletRequest {
  userId: string;
  username: string;
}

export interface CreateWalletResponse {
  walletAddress: string;
  mnemonic: string;
  success: boolean;
  error?: string;
}

@injectable()
export class CreateWalletUseCase {
  constructor(
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('WalletRepository') private walletRepository: WalletRepository,
    @inject('WalletService') private walletService: WalletService,
    @inject('EncryptionService') private encryptionService: EncryptionService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  async execute(request: CreateWalletRequest): Promise<CreateWalletResponse> {
    try {
      this.logger.info('Creating wallet for user', { userId: request.userId });

      // Check if user already has a wallet
      const existingWallet = await this.walletRepository.findByUserId(request.userId);
      if (existingWallet) {
        return {
          walletAddress: '',
          mnemonic: '',
          success: false,
          error: 'User already has a wallet',
        };
      }

      // Create or update user
      const user = User.create(request.userId, request.username);
      await this.userRepository.save(user);

      // Generate new key pair and mnemonic
      const keyPair = await this.walletService.generateKeyPair();
      const mnemonic = this.walletService.generateMnemonic();

      // Encrypt the seed (we'll use the mnemonic as seed for simplicity)
      const encryptedSeed = await this.encryptionService.encryptSeed(
        mnemonic,
        env.KMS_CMK_USER_KEY_ID
      );

      // Create wallet entity
      const wallet = Wallet.create(
        request.userId,
        keyPair.publicKey,
        encryptedSeed
      );

      // Save wallet
      await this.walletRepository.save(wallet);

      this.logger.info('Wallet created successfully', {
        userId: request.userId,
        walletAddress: keyPair.publicKey,
      });

      return {
        walletAddress: keyPair.publicKey,
        mnemonic,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to create wallet', error as Error, {
        userId: request.userId,
      });

      return {
        walletAddress: '',
        mnemonic: '',
        success: false,
        error: `Failed to create wallet: ${error}`,
      };
    }
  }
}