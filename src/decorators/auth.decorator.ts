import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';

export function Auth() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard));
}
