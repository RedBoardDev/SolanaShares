import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { createCipher, createDecipher, randomBytes } from 'crypto';
import { EncryptionService } from '../../domain/ports/services';
import { EncryptedSeed } from '../../domain/entities/Wallet';
import { env } from '../../config/environment';

export class KMSEncryptionService implements EncryptionService {
  private kmsClient: KMSClient;

  constructor() {
    this.kmsClient = new KMSClient({
      region: env.AWS_REGION,
      credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      } : undefined,
    });
  }

  async encryptSeed(seed: string, keyId: string): Promise<EncryptedSeed> {
    try {
      // Generate data key from KMS
      const dataKeyCommand = new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: 'AES_256',
      });

      const dataKeyResponse = await this.kmsClient.send(dataKeyCommand);
      
      if (!dataKeyResponse.Plaintext || !dataKeyResponse.CiphertextBlob) {
        throw new Error('Failed to generate data key');
      }

      // Generate nonce for AES encryption
      const nonce = randomBytes(16);
      
      // Encrypt seed with the plaintext data key using AES-256-GCM
      const cipher = createCipher('aes-256-gcm', dataKeyResponse.Plaintext);
      cipher.setAAD(nonce);
      
      let cipherSeed = cipher.update(seed, 'utf8', 'base64');
      cipherSeed += cipher.final('base64');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();

      return {
        cipherSeed: cipherSeed + ':' + authTag.toString('base64'),
        cipherDataKey: Buffer.from(dataKeyResponse.CiphertextBlob).toString('base64'),
        nonce: nonce.toString('base64'),
      };
    } catch (error) {
      throw new Error(`Failed to encrypt seed: ${error}`);
    }
  }

  async decryptSeed(encryptedSeed: EncryptedSeed, keyId: string): Promise<string> {
    try {
      // Decrypt the data key using KMS
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedSeed.cipherDataKey, 'base64'),
      });

      const decryptResponse = await this.kmsClient.send(decryptCommand);
      
      if (!decryptResponse.Plaintext) {
        throw new Error('Failed to decrypt data key');
      }

      // Extract cipher text and auth tag
      const [cipherText, authTagB64] = encryptedSeed.cipherSeed.split(':');
      const authTag = Buffer.from(authTagB64, 'base64');
      const nonce = Buffer.from(encryptedSeed.nonce, 'base64');

      // Decrypt seed with the plaintext data key
      const decipher = createDecipher('aes-256-gcm', decryptResponse.Plaintext);
      decipher.setAAD(nonce);
      decipher.setAuthTag(authTag);
      
      let seed = decipher.update(cipherText, 'base64', 'utf8');
      seed += decipher.final('utf8');

      return seed;
    } catch (error) {
      throw new Error(`Failed to decrypt seed: ${error}`);
    }
  }
}