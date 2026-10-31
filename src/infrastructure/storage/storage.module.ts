import { Module } from '@nestjs/common';
import { S3UploadStorage } from './s3-upload.storage';

@Module({ providers: [S3UploadStorage], exports: [S3UploadStorage] })
export class StorageModule {}
