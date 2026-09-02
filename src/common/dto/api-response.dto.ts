import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;

  @ApiProperty()
  data: T;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { page: 1, limit: 10, total: 100 },
  })
  meta?: Record<string, any>;
}

export class ErrorDetailDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiPropertyOptional({ example: 'Invalid input data' })
  details?: any;

  @ApiPropertyOptional({
    example: { email: ['Email is required'], password: ['Password too short'] },
  })
  errors?: Record<string, string[]>;

  @ApiPropertyOptional({ example: 'trace-id-12345' })
  traceId?: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'An error occurred' })
  message: string;

  @ApiProperty({ type: ErrorDetailDto })
  error: ErrorDetailDto;
}
