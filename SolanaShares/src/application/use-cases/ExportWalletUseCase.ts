import { injectable, inject } from 'tsyringe';
import { WalletRepository } from '../../domain/ports/repositories';
import { EncryptionService, LoggerService } from '../../domain/ports/services';
import { env } from '../../config/environment';

export interface ExportWalletRequest {
  userId: string;
}

export interface ExportWalletResponse {
  walletAddress: string;
  privateKey: string;
  success: boolean;
  error?: string;
}

@injectable()
export class ExportWalletUseCase {
  constructor(
    @inject('WalletRepository') private walletRepository: WalletRepository,
    @inject('EncryptionService') private encryptionService: EncryptionService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  async execute(request: ExportWalletRequest): Promise<ExportWalletResponse> {
    try {
      this.logger.info('Exporting wallet for user', { userId: request.userId });

      // Find user's wallet
      const wallet = await this.walletRepository.findByUserId(request.userId);
      if (!wallet) {
        return {
          walletAddress: '',
          privateKey: '',
          success: false,
          error: 'No wallet found for this user',
        };
      }

      // Decrypt the private key
      const decryptedPrivateKey = await this.encryptionService.decryptSeed(
        wallet.encryptedSeed,
        env.KMS_CMK_USER_KEY_ID
      );

      this.logger.info('Wallet exported successfully', {
        userId: request.userId,
        walletAddress: wallet.walletAddress,
      });

      return {
        walletAddress: wallet.walletAddress,
        privateKey: decryptedPrivateKey,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to export wallet', error as Error, {
        userId: request.userId,
      });

      return {
        walletAddress: '',
        privateKey: '',
        success: false,
        error: `Failed to export wallet: ${error}`,
      };
    }
  }
}