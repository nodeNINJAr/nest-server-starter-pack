import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RoleChecker } from '../src/core/security/decorators/roles.decorator';

@Controller('test-protected')
class ProtectedController {
  @Get() read() {
    return { protected: true };
  }
  @RoleChecker('admin')
  @Get('admin')
  admin() {
    return { admin: true };
  }
}

describe('API bootstrap and boundaries (infrastructure mocked)', () => {
  let app: NestExpressApplication;
  let token: string;
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
    session: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const redis = {
    ping: jest.fn().mockResolvedValue('PONG'),
    consumeRateLimit: jest.fn().mockResolvedValue({ count: 1, ttl: 60 }),
  };
  beforeAll(async () => {
    const builder = Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedController],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis);
    for (const name of ['email-queue', 'notification-queue', 'sms-queue']) {
      builder.overrideProvider(getQueueToken(name)).useValue({ add: jest.fn(), close: jest.fn() });
    }
    const module = await builder.compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    token = app.get(JwtService).sign({ sub: 'user-1', sid: 'session-1' });
  });
  beforeEach(() => {
    prisma.session.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      accountStatus: 'active',
      role: { name: 'user' },
    });
    redis.consumeRateLimit.mockResolvedValue({ count: 1, ttl: 60 });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('boots without any AWS, SMTP, Twilio, or Firebase configuration', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeDefined();
  });
  it('keeps root information public at the real API prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect(/NestJS Starter/);
  });
  it('protects new routes without requiring an auth decorator', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/test-protected').expect(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED', statusCode: 401 },
    });
    expect(response.body.error.traceId).toBe(response.headers['x-request-id']);
  });
  it('accepts authenticated routes and enforces role metadata', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test-protected')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/test-protected/admin')
      .auth(token, { type: 'bearer' })
      .expect(403);
  });
  it('rejects a revoked access-token session', async () => {
    prisma.session.findUnique.mockResolvedValueOnce({
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });
  it('uses the shared validation and error contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'jane', password: 'short', unexpected: true })
      .expect(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining(['property unexpected should not exist']),
    );
  });
  it('limits public auth requests through Redis', async () => {
    redis.consumeRateLimit.mockResolvedValueOnce({ count: 11, ttl: 42 });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'jane', password: 'secure-password' })
      .expect(429);
    expect(response.headers['retry-after']).toBe('42');
  });
  it('returns 503 from readiness when a dependency fails', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    redis.ping.mockRejectedValueOnce(new Error('Redis offline'));
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
  it('returns a clear unavailable response when optional storage is used', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/upload')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.from('test-image'), {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(503);
    expect(response.body.error.code).toBe('UNAVAILABLE');
  });
  it('rejects missing files and unsupported media before storage', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/upload')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/upload')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.from('<script/>'), {
        filename: 'test.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);
  });
  it('allows only explicitly configured browser origins', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://frontend.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://frontend.example.com');
    const denied = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://anything.ngrok.app');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
