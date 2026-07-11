type Environment = Record<string, string | undefined>;

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'CSRF_SECRET',
];

// Secrets shorter than this are trivially brute-forceable. Enforced hard in
// production; a loud warning in other environments so local dev is not blocked.
const MIN_SECRET_LENGTH = 32;
const lengthCheckedSecrets = ['JWT_SECRET', 'TOKEN_ENCRYPTION_KEY', 'CSRF_SECRET'];

export function validateEnvironment(config: Environment) {
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const isProduction = config.NODE_ENV === 'production';
  const weak = lengthCheckedSecrets.filter(
    (key) => (config[key] ?? '').length < MIN_SECRET_LENGTH,
  );

  if (weak.length > 0) {
    const detail = `${weak.join(', ')} must be at least ${MIN_SECRET_LENGTH} characters. Generate with: openssl rand -base64 48`;
    if (isProduction) {
      throw new Error(`Weak secrets rejected in production: ${detail}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[env] WARNING — weak secrets detected (${detail}).`);
  }

  return {
    ...config,
    PORT: Number(config.PORT ?? 4000),
    OPENROUTER_BASE_URL:
      config.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    OPENROUTER_MODEL: config.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini',
    OPENROUTER_IMAGE_MODEL:
      config.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image',
    AI_MOCK: config.AI_MOCK ?? 'false',
  };
}
