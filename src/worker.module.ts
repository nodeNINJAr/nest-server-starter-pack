import { Module } from '@nestjs/common';
import { AppConfigModule } from './core/config/app-config.module';
import { WorkersModule } from './infrastructure/queue/workers.module';

@Module({ imports: [AppConfigModule, WorkersModule] })
export class WorkerModule {}
