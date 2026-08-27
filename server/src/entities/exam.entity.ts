import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

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
}
