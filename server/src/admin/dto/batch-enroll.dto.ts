import { IsArray, IsOptional, IsString, IsInt } from 'class-validator';

export class BatchEnrollDto {
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  userIds?: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rollNumbers?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emails?: string[];
}
