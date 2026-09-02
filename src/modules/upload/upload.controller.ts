import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../decorators/auth.decorator';
import { storageConfig } from '../../config/aws/storage.config';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  @Auth()
  @Post()
  @ApiOperation({ summary: 'Upload a single file to S3' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: storageConfig() }))
  upload(@UploadedFile() file: Express.Multer.File & { key: string; location: string }) {
    return {
      key: file.key,
      url: file.location,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
