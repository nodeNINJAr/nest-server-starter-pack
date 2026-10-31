import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityModule } from '../../core/security/security.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [SecurityModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
