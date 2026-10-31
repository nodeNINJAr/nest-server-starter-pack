process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/starter_test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SWAGGER_ENABLED = 'false';
process.env.CORS_ORIGINS = 'https://frontend.example.com';
process.env.UPLOAD_MAX_BYTES = '1024';
for (const key of [
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'SMTP_HOST',
  'TWILIO_SID',
  'TWILIO_AUTH_TOKEN',
  'FIREBASE_SERVICE_ACCOUNT',
])
  delete process.env[key];
