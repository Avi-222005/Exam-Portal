import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface ProctoringConfig {
  isProctored: boolean;
  enforceFullscreen: boolean;
  preventTabSwitching: boolean;
  detectSidePanel: boolean;
  preventCopyPaste: boolean;
  blockDevTools: boolean;
  showWatermark: boolean;
  maxViolations?: number;
}

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  isProctored: true,
  enforceFullscreen: true,
  preventTabSwitching: true,
  detectSidePanel: true,
  preventCopyPaste: true,
  blockDevTools: true,
  showWatermark: true,
  maxViolations: 5,
};

@Entity('exams')
@Index(['isActive', 'endTime'])
export class Exam extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  allowedLanguages: number[];

  @Column({ type: 'varchar', length: 32, default: 'open' })
  accessType: 'open' | 'passcode' | 'whitelist';

  @Column({ type: 'varchar', length: 255, nullable: true })
  passcode?: string | null;

  @Column({ type: 'int', default: 5 })
  maxViolations: number;

  @Column({
    type: 'jsonb',
    default: () =>
      `'{"isProctored":true,"enforceFullscreen":true,"preventTabSwitching":true,"detectSidePanel":true,"preventCopyPaste":true,"blockDevTools":true,"showWatermark":true,"maxViolations":5}'`,
  })
  proctoringConfig: ProctoringConfig;
}
