import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const supplied = req.get('x-request-id');
  const requestId = supplied && /^[a-zA-Z0-9_-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
