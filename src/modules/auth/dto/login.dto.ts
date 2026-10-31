import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsByteLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane_doe', description: 'Username or email' })
  @IsString()
  @MaxLength(254)
  identifier: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  password: string;
}
