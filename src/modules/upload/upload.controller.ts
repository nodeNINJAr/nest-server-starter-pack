import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../core/security/decorators/auth.decorator';
import { ApiResponses } from '../../common/http/api-responses';

const MAX_FILES = 10;

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  @Auth()
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Upload a single image to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A file is required');
    return ApiResponses.success(this.toResult(file), 'File uploaded successfully');
  }

  @Auth()
  @ApiBearerAuth()
  @Post('multiple')
  @ApiOperation({ summary: `Upload multiple images to S3 (max ${MAX_FILES})` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_FILES))
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('At least one file is required');
    return ApiResponses.success(
      files.map((file) => this.toResult(file)),
      'Files uploaded successfully',
    );
  }

  private toResult(file: Express.Multer.File) {
    return {
      key: file.key,
      url: file.location,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
