import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pkg from '../package.json';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}
  getPlatformInfo() {
    return {
      name: pkg.name,
      product: 'Universal NestJS Starter',
      version: pkg.version,
      environment: this.config.get<string>('NODE_ENV'),
    };
  }
  getServices() {
    return [
      {
        key: 'auth',
        name: 'Authentication',
        description: 'Session-based JWT authentication and roles.',
      },
      {
        key: 'upload',
        name: 'File uploads',
        description: 'Optional authenticated S3 image uploads.',
      },
      {
        key: 'notification',
        name: 'Background delivery',
        description: 'Optional email, SMS, and push delivery through separate workers.',
      },
      { key: 'health', name: 'Health', description: 'Liveness and database/Redis readiness.' },
    ];
  }
}
