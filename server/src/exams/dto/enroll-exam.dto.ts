import { IsOptional, IsString } from 'class-validator';

export class EnrollExamDto {
  @IsString()
  @IsOptional()
  passcode?: string;
}
