import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}
  check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
  async ready() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), 2000);
        }),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Dependencies are unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
}
