import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { createClient, type RedisClientType } from 'redis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<RedisClientType> => {
        const client: RedisClientType = createClient({
          socket: {
            host: config.get('REDIS_HOST'),
            port: Number(config.get('REDIS_PORT')),
          },
          username: config.get('REDIS_USERNAME') || undefined,
          password: config.get('REDIS_PASSWORD') || undefined,
        });

        client.on('ready', () => console.log('✅ Redis Connected'));
        client.on('error', (err) => console.error('🚨 Redis Client Error:', err));

        await client.connect();
        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
