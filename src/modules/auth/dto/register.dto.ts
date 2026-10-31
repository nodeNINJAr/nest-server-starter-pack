import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, MaxLength, IsByteLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  password: string;

  @ApiPropertyOptional({ example: '+15550001234' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
