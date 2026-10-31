/** Parse once at startup. Optional integrations validate when their capability is used. */
export function validateEnvironment(input: Record<string, unknown>) {
  const env = { ...input };
  const required = (name: string) => {
    const value = String(env[name] ?? '').trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
    env[name] = value;
  };
  const boolean = (name: string, fallback: boolean) => {
    const value = env[name] ?? fallback;
    if (![true, false, 'true', 'false'].includes(value as boolean | string)) {
      throw new Error(`${name} must be true or false`);
    }
    env[name] = value === true || value === 'true';
  };

  env.NODE_ENV ??= 'development';
  if (!['development', 'test', 'production'].includes(String(env.NODE_ENV))) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const databaseUrl = new URL(required('DATABASE_URL'));
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const secret = required('JWT_SECRET');
  if (secret.length < 32 || /changeme|replace.?me/i.test(secret)) {
    throw new Error('JWT_SECRET must contain at least 32 characters and cannot be a placeholder');
  }
  env.JWT_SECRET = secret;
  env.HOST ??= '0.0.0.0';
  env.REDIS_HOST ||= 'localhost';
  env.CORS_ORIGINS ??= 'http://localhost:3000,http://localhost:5173';
  for (const origin of String(env.CORS_ORIGINS).split(',').filter(Boolean)) {
    const url = new URL(origin.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin.trim()) {
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins without paths');
    }
  }
  integer('PORT', 8000, 1, 65535);
  integer('REDIS_PORT', 6379, 1, 65535);
  integer('UPLOAD_MAX_BYTES', 5 * 1024 * 1024, 1, 100 * 1024 * 1024);
  integer('TRUST_PROXY_HOPS', 0, 0, 10);
  boolean('SWAGGER_ENABLED', env.NODE_ENV !== 'production');
  return env;
}
