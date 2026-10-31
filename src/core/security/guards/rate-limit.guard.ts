import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitPolicy } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const identity = createHash('sha256')
      .update(`${request.ip}:${context.getClass().name}:${context.getHandler().name}`)
      .digest('hex');
    let result: { count: number; ttl: number };
    try {
      result = await this.redis.consumeRateLimit(`rate:${identity}`, policy.windowSeconds);
    } catch {
      throw new ServiceUnavailableException('Request limits are temporarily unavailable');
    }
    if (result.count > policy.limit) {
      response.setHeader('Retry-After', Math.max(1, result.ttl));
      throw new HttpException('Too many requests. Try again later.', 429);
    }
    return true;
  }
}
