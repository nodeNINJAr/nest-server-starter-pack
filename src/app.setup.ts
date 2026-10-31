import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { requestContext } from './common/http/request-context.middleware';
import pkg from '../package.json';

/** Shared by the real server and HTTP tests to avoid bootstrap drift. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  app.disable('x-powered-by');
  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS') ?? 0);
  app.setGlobalPrefix('api/v1');
  app.use(requestContext);
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle(pkg.name).setVersion(pkg.version).addBearerAuth().build(),
    );
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }
}
