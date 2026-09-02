export class ApiResponses {
  // ─── Success ──────────────────────────────────────────────────────────────

  static success<T>(data: T, message = 'Success', meta?: Record<string, any>) {
    return {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    } as const;
  }

  static paginated<T>(
    data: T[],
    meta: { page: number; limit: number; total: number; totalPages: number },
    message = 'Success',
  ) {
    return {
      success: true,
      message,
      data,
      meta,
    } as const;
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  static error(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      details?: any;
      errors?: Record<string, string[]>;
      traceId?: string;
    },
  ) {
    return {
      success: false,
      message,
      error: {
        code: options?.code ?? 'ERROR',
        statusCode: options?.statusCode ?? 500,
        details: options?.details ?? null,
        errors: options?.errors ?? null,
        traceId: options?.traceId ?? null,
      },
    } as const;
  }

  // ─── Common shorthands ────────────────────────────────────────────────────

  static notFound(resource: string) {
    return this.error(`${resource} not found`, { code: 'NOT_FOUND', statusCode: 404 });
  }

  static conflict(message: string) {
    return this.error(message, { code: 'CONFLICT', statusCode: 409 });
  }

  static forbidden(message = 'Access denied') {
    return this.error(message, { code: 'FORBIDDEN', statusCode: 403 });
  }

  static validationError(errors: Record<string, string[]>) {
    return this.error('Validation failed', {
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      errors,
    });
  }
}
