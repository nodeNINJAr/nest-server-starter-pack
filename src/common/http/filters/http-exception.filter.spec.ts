import { ArgumentsHost, BadRequestException, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { GlobalExceptionFilter } from './http-exception.filter';

function responseFor(error: unknown) {
  const res = {
    locals: { requestId: 'request-123' },
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'POST', path: '/api/v1/example' }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(error, host);
  return {
    status: res.status.mock.calls[0][0] as number,
    body: res.json.mock.calls[0][0] as {
      message: string;
      error: { code: string; details: unknown; traceId: string };
    },
  };
}
describe('global error contract', () => {
  it('maps database unique violations to 409 without leaking metadata', () => {
    const result = responseFor(
      new Prisma.PrismaClientKnownRequestError('Sensitive SQL query', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('CONFLICT');
    expect(JSON.stringify(result.body)).not.toContain('Sensitive SQL');
  });
  it('preserves validation details and the request trace ID', () => {
    const result = responseFor(new BadRequestException(['email must be an email']));
    expect(result.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: ['email must be an email'],
      traceId: 'request-123',
    });
  });
  it('handles string HttpException responses', () => {
    const result = responseFor(new HttpException('Access denied', 403));
    expect(result.status).toBe(403);
    expect(result.body.message).toBe('Access denied');
  });
  it('hides unexpected internal errors', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const result = responseFor(new Error('postgresql://user:password@host/database'));
      expect(result.status).toBe(500);
      expect(JSON.stringify(result.body)).not.toContain('password');
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
    } finally {
      log.mockRestore();
    }
  });
});
