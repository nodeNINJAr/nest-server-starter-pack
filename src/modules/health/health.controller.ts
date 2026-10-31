import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/security/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get()
  check() {
    return this.health.check();
  }
  @Get('ready')
  ready() {
    return this.health.ready();
  }
}
