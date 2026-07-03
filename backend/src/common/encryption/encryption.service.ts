import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

type EncryptedPayload = {
  v: number;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
};

/**
 * Centralized AES-256-GCM encryption for provider secrets.
 * Tokens must never be logged or returned from controllers.
 */
@Injectable()
export class EncryptionService {
  private readonly currentKey: Buffer;
  private readonly currentVersion: number;
  private readonly previousKeys: Map<number, Buffer>;

  constructor(private readonly config: ConfigService) {
    this.currentKey = this.normalizeKey(
      this.config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY'),
    );
    this.currentVersion = Number(
      this.config.get<string>('TOKEN_ENCRYPTION_KEY_VERSION') ?? 1,
    );
    this.previousKeys = this.parsePreviousKeys(
      this.config.get<string>('TOKEN_ENCRYPTION_PREVIOUS_KEYS'),
    );
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.currentKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const payload: EncryptedPayload = {
      v: this.currentVersion,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      data: ciphertext.toString('base64url'),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decrypt(ciphertext: string): string {
    const payload = this.decodePayload(ciphertext);
    const key =
      payload.v === this.currentVersion
        ? this.currentKey
        : this.previousKeys.get(payload.v);

    if (!key) {
      throw new InternalServerErrorException('Encryption key version is unavailable.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(payload.iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  rotateKey(ciphertext: string): string {
    return this.encrypt(this.decrypt(ciphertext));
  }

  getCurrentKeyVersion(): number {
    return this.currentVersion;
  }

  private decodePayload(ciphertext: string): EncryptedPayload {
    try {
      const raw = Buffer.from(ciphertext, 'base64url').toString('utf8');
      const payload = JSON.parse(raw) as EncryptedPayload;
      if (payload.alg !== 'aes-256-gcm') {
        throw new Error('Unsupported algorithm.');
      }
      return payload;
    } catch {
      throw new InternalServerErrorException('Encrypted payload is invalid.');
    }
  }

  private normalizeKey(value: string): Buffer {
    const trimmed = value.trim();
    const decoded = this.tryDecodeKey(trimmed);

    if (decoded.length === 32) {
      return decoded;
    }

    return createHash('sha256').update(trimmed).digest();
  }

  private tryDecodeKey(value: string): Buffer {
    if (/^[a-f0-9]{64}$/i.test(value)) {
      return Buffer.from(value, 'hex');
    }

    try {
      return Buffer.from(value, 'base64');
    } catch {
      return Buffer.from(value, 'utf8');
    }
  }

  private parsePreviousKeys(raw?: string): Map<number, Buffer> {
    const keys = new Map<number, Buffer>();
    if (!raw) {
      return keys;
    }

    for (const part of raw.split(',').map((item) => item.trim()).filter(Boolean)) {
      const [version, key] = part.split(':');
      const parsedVersion = Number(version);
      if (parsedVersion && key) {
        keys.set(parsedVersion, this.normalizeKey(key));
      }
    }

    return keys;
  }
}
