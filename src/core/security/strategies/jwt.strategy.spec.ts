import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

function fixture() {
  const prisma = {
    session: {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', accountStatus: 'active' }) },
  };
  return {
    prisma,
    strategy: new JwtStrategy(
      prisma as unknown as PrismaService,
      new ConfigService({ JWT_SECRET: 'test-secret-with-at-least-32-characters' }),
    ),
  };
}
describe('access-token session validation', () => {
  it('rejects tokens without a session identifier', async () => {
    const { strategy } = fixture();
    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow('Invalid access token');
  });
  it('rejects a logged-out session immediately', async () => {
    const { prisma, strategy } = fixture();
    prisma.session.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await expect(strategy.validate({ sub: 'user-1', sid: 'session-1' })).rejects.toThrow(
      'Session has ended',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a session belonging to another user', async () => {
    const { strategy } = fixture();
    await expect(strategy.validate({ sub: 'another-user', sid: 'session-1' })).rejects.toThrow(
      'Session has ended',
    );
  });
  it('returns the current active user', async () => {
    const { strategy } = fixture();
    await expect(strategy.validate({ sub: 'user-1', sid: 'session-1' })).resolves.toMatchObject({
      id: 'user-1',
    });
  });
});
