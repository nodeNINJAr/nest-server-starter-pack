import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import multerS3 from 'multer-s3';

@Injectable()
export class S3UploadStorage implements StorageEngine, OnModuleDestroy {
  private client?: S3Client;
  private storage?: StorageEngine;
  constructor(private readonly config: ConfigService) {}

  private getStorage(): StorageEngine {
    if (this.storage) return this.storage;
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    const region = this.config.get<string>('AWS_REGION');
    if (!bucket || !region) throw new ServiceUnavailableException('File storage is not configured');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
      throw new ServiceUnavailableException('File storage credentials are incomplete');
    }
    this.client = new S3Client({
      region,
      // Omitting credentials enables the AWS default chain (including IAM roles).
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
    this.storage = multerS3({
      s3: this.client,
      bucket,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (_req, _file, callback) => callback(null, `uploads/${randomUUID()}`),
    });
    return this.storage;
  }

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    callback: Parameters<StorageEngine['_handleFile']>[2],
  ) {
    try {
      this.getStorage()._handleFile(req, file, callback);
    } catch (error) {
      callback(error as Error);
    }
  }
  _removeFile(req: Request, file: Express.Multer.File, callback: (error: Error | null) => void) {
    if (this.storage) this.storage._removeFile(req, file, callback);
    else callback(null);
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
}
