import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HOST'));
  Logger.log(`API listening on ${await app.getUrl()}/api/v1`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error('API startup failed', error);
  process.exitCode = 1;
});
