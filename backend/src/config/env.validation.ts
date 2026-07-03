type Environment = Record<string, string | undefined>;

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'CSRF_SECRET',
];

export function validateEnvironment(config: Environment) {
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return {
    ...config,
    PORT: Number(config.PORT ?? 4000),
    OPENROUTER_BASE_URL:
      config.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    OPENROUTER_MODEL: config.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini',
  };
}
