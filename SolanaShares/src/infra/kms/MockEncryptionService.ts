import { randomBytes, createCipher, createDecipher } from 'crypto';
import { EncryptionService } from '../../domain/ports/services';
import { EncryptedSeed } from '../../domain/entities/Wallet';

export class MockEncryptionService implements EncryptionService {
  private mockKey = 'mock-encryption-key-for-development-only-32bytes';

  async encryptSeed(seed: string, keyId: string): Promise<EncryptedSeed> {
    try {
      // Generate nonce for encryption
      const nonce = randomBytes(16);
      
      // Encrypt seed with mock key
      const cipher = createCipher('aes-256-cbc', this.mockKey);
      let cipherSeed = cipher.update(seed, 'utf8', 'base64');
      cipherSeed += cipher.final('base64');

      return {
        cipherSeed,
        cipherDataKey: 'mock-encrypted-data-key',
        nonce: nonce.toString('base64'),
      };
    } catch (error) {
      throw new Error(`Mock encryption failed: ${error}`);
    }
  }

  async decryptSeed(encryptedSeed: EncryptedSeed, keyId: string): Promise<string> {
    try {
      // Decrypt seed with mock key
      const decipher = createDecipher('aes-256-cbc', this.mockKey);
      let seed = decipher.update(encryptedSeed.cipherSeed, 'base64', 'utf8');
      seed += decipher.final('utf8');

      return seed;
    } catch (error) {
      throw new Error(`Mock decryption failed: ${error}`);
    }
  }
}