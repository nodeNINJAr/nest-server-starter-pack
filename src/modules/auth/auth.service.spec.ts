import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const sessionId = '7f0e3fbc-5321-4000-8000-111111111111';
const secret = 'a'.repeat(64);
const token = `${sessionId}.${secret}`;
let hash: string;
beforeAll(async () => {
  hash = await bcrypt.hash(secret, 4);
});

function fixture() {
  const session = {
    id: sessionId,
    userId: 'user-1',
    refreshTokenHash: hash,
    expiresAt: new Date(Date.now() + 60000),
    revokedAt: null as Date | null,
    user: { accountStatus: 'active' },
  };
  const tx = {
    session: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({}),
    },
    role: { upsert: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    user: {
      create: jest.fn().mockResolvedValue({ id: 'user-1', password: 'hashed', username: 'jane' }),
    },
  };
  const prisma = {
    session: {
      findUnique: jest.fn().mockResolvedValue(session),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const jwt = { sign: jest.fn().mockReturnValue('signed-access-token') };
  return {
    service: new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService),
    prisma,
    tx,
    jwt,
    session,
  };
}

describe('AuthService sessions', () => {
  it('claims and replaces a refresh token inside the same transaction', async () => {
    const { service, prisma, tx, jwt } = fixture();
    const result = await service.refresh(token, { ipAddress: '127.0.0.1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sessionId,
          revokedAt: null,
          user: { accountStatus: 'active' },
        }),
      }),
    );
    expect(tx.session.create).toHaveBeenCalledTimes(1);
    const newSession = tx.session.create.mock.calls[0][0].data as {
      id: string;
      refreshTokenHash: string;
    };
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'user-1', sid: newSession.id });
    expect(result.refreshToken).toMatch(new RegExp(`^${newSession.id}\\.[a-f0-9]{64}$`));
    expect(newSession.refreshTokenHash).not.toContain(result.refreshToken.split('.')[1]);
  });
  it('rejects a losing concurrent rotation without issuing another session', async () => {
    const { service, tx } = fixture();
    tx.session.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.session.create).not.toHaveBeenCalled();
  });
  it('propagates replacement failure from the transaction so revocation can roll back', async () => {
    const { service, tx } = fixture();
    tx.session.create.mockRejectedValue(new Error('database failure'));
    await expect(service.refresh(token, {})).rejects.toThrow('database failure');
  });
  it.each(['inactive', 'banned'])('rejects refresh for an %s account', async (status) => {
    const { service, session, prisma } = fixture();
    session.user.accountStatus = status;
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects expired or revoked refresh tokens', async () => {
    const { service, session } = fixture();
    session.expiresAt = new Date(0);
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
    session.expiresAt = new Date(Date.now() + 60000);
    session.revokedAt = new Date();
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('requires the secret to log out; a known session ID is insufficient', async () => {
    const { service, prisma } = fixture();
    await expect(service.logout(`${sessionId}.${'b'.repeat(64)}`)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
    await service.logout(token);
    expect(prisma.session.updateMany).toHaveBeenCalledTimes(1);
  });
  it('rejects extra token segments', async () => {
    const { service, prisma } = fixture();
    await expect(service.refresh(`${token}.extra`, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
  it('registers the account and its session in one transaction without returning the password', async () => {
    const { service, tx, prisma } = fixture();
    const result = await service.register(
      { username: 'jane', email: 'jane@example.com', password: 'secure-password' },
      {},
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalled();
    expect(tx.session.create).toHaveBeenCalled();
    expect(result.user).not.toHaveProperty('password');
  });
});
