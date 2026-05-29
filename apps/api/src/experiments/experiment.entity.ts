import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  mode: string;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: ExperimentStatus;

  @Column({ type: 'jsonb', default: {} })
  metrics: {
    loss?: number;
    accuracy?: number;
    learningRate?: number;
    epoch?: number;
    [key: string]: unknown;
  };

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;
}
