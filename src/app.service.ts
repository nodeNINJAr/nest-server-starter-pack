import { Injectable } from '@nestjs/common';
import pkg from '../package.json';

@Injectable()
export class AppService {
  getPlatformInfo() {
    return {
      name: pkg.name,
      product: 'NestJS Starter Pack',
      version: pkg.version,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  getServices() {
    return [
      {
        key: 'notification',
        name: 'Notification Service',
        description: 'Email, SMS, and in-app notifications.',
      },
    ];
  }
}
