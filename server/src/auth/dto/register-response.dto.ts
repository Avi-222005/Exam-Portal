import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './auth-response.dto';

export class RegisterResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ required: false, example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken?: string;
}
