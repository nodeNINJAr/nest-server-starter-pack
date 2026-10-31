import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}
export const RateLimit = (limit: number, windowSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, {
    limit,
    windowSeconds,
  } satisfies RateLimitPolicy);
