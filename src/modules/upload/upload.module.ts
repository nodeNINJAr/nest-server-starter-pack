import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { S3UploadStorage } from '../../infrastructure/storage/s3-upload.storage';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [StorageModule],
      inject: [S3UploadStorage, ConfigService],
      useFactory: (storage: S3UploadStorage, config: ConfigService) => ({
        storage,
        limits: {
          fileSize: config.getOrThrow<number>('UPLOAD_MAX_BYTES'),
          files: 10,
          fields: 0,
          parts: 11,
        },
        fileFilter: (_req, file, callback) => {
          if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            return callback(
              new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed'),
              false,
            );
          }
          callback(null, true);
        },
      }),
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
