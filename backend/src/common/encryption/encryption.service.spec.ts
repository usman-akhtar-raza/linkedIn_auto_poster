import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'TOKEN_ENCRYPTION_KEY') {
        return 'test-encryption-secret';
      }
      throw new Error(`Missing ${key}`);
    },
    get: (key: string) => {
      if (key === 'TOKEN_ENCRYPTION_KEY_VERSION') {
        return '1';
      }
      return undefined;
    },
  } as ConfigService;

  it('encrypts and decrypts with AES-256-GCM payloads', () => {
    const service = new EncryptionService(config);
    const encrypted = service.encrypt('linkedin-access-token');

    expect(encrypted).not.toContain('linkedin-access-token');
    expect(service.decrypt(encrypted)).toBe('linkedin-access-token');
  });

  it('rotates ciphertext without changing plaintext', () => {
    const service = new EncryptionService(config);
    const encrypted = service.encrypt('linkedin-refresh-token');
    const rotated = service.rotateKey(encrypted);

    expect(rotated).not.toBe(encrypted);
    expect(service.decrypt(rotated)).toBe('linkedin-refresh-token');
  });
});
