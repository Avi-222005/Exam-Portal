import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsArray,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  allowedLanguages?: number[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  problemIds?: number[];

  @IsString()
  @IsOptional()
  accessType?: 'open' | 'passcode' | 'whitelist';

  @IsString()
  @IsOptional()
  passcode?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxViolations?: number;

  @IsOptional()
  proctoringConfig?: {
    isProctored?: boolean;
    enforceFullscreen?: boolean;
    preventTabSwitching?: boolean;
    detectSidePanel?: boolean;
    preventCopyPaste?: boolean;
    blockDevTools?: boolean;
    showWatermark?: boolean;
    maxViolations?: number;
  };
}
