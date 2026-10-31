import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

/** Authentication is global; this decorator adds API documentation. */
export function Auth() {
  return applyDecorators(ApiBearerAuth());
}
