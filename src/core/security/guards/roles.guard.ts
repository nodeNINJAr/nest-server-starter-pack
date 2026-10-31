import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: { role?: { name: string } } }>();
    if (!user?.role || !required.includes(user.role.name)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
