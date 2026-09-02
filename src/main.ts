import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import pkg from '../package.json';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SocketIOAdapter } from './config/adapters/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn'],
    rawBody: true,
  });

  // Global prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  //
  app.useWebSocketAdapter(new SocketIOAdapter(app));

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:8000',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5500',
        ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
      ];

      const isAllowedStatic = allowedOrigins.includes(origin);

      // Allow any ngrok, nip.io, or sslip.io tunnel dynamically (handy in local dev)
      const isAllowedDynamic =
        origin.endsWith('.ngrok-free.app') ||
        origin.endsWith('.ngrok.io') ||
        origin.endsWith('.ngrok.app') ||
        origin.endsWith('.nip.io') ||
        origin.endsWith('.sslip.io');

      if (isAllowedStatic || isAllowedDynamic) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle(pkg.name)
    .setVersion(pkg.version)
    .addServer('/', 'Default (Relative)')
    .addServer(process.env.API_URL ?? 'http://localhost:8000', 'Custom URL')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: `${pkg.name} Docs`,
  });

  // ENV config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 8000;
  const host = configService.get<string>('HOST') ?? '0.0.0.0';

  // app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  await app.listen(port, host);
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 ${pkg.name}
║   📡 Running on: http://localhost:${port}/api/v1
║   📚 Swagger:    http://localhost:${port}/api/v1/docs
║   Environment:   ${process.env.NODE_ENV || 'development'}
╚═══════════════════════════════════════════════════════╝
  `);
}
bootstrap();
