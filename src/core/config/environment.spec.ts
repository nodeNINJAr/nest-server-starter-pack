import { validateEnvironment } from './environment';

const valid = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'a-test-secret-with-at-least-32-characters',
};
describe('environment validation', () => {
  it('boots with only required settings and no integration credentials', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 8000,
      REDIS_PORT: 6379,
      SWAGGER_ENABLED: true,
    });
  });
  it('parses booleans instead of treating the string false as truthy', () => {
    expect(validateEnvironment({ ...valid, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
  });
  it('disables documentation by default in production', () => {
    expect(validateEnvironment({ ...valid, NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
  });
  it.each([
    { JWT_SECRET: '' },
    { JWT_SECRET: 'changeme' },
    { JWT_SECRET: 'changeme-'.repeat(8) },
    { DATABASE_URL: 'mysql://test:test@localhost/test' },
    { PORT: 'NaN' },
    { PORT: '0' },
    { REDIS_PORT: '65536' },
    { NODE_ENV: 'unknown' },
    { SWAGGER_ENABLED: 'yes' },
    { TRUST_PROXY_HOPS: '-1' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com/path' },
  ])('rejects invalid configuration: %j', (invalid) => {
    expect(() => validateEnvironment({ ...valid, ...invalid })).toThrow();
  });
});
