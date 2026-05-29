import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ExperimentStatus } from './experiment.entity';

export class CreateExperimentDto {
  @ApiProperty({ description: 'Name of the experiment' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Research mode', example: 'hyperparameter' })
  @IsString()
  mode: string;

  @ApiPropertyOptional({ description: 'Experiment configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateExperimentDto {
  @ApiPropertyOptional({
    description: 'Experiment status',
    enum: ['pending', 'running', 'completed', 'failed'],
  })
  @IsOptional()
  @IsEnum(['pending', 'running', 'completed', 'failed'])
  status?: ExperimentStatus;

  @ApiPropertyOptional({ description: 'Experiment metrics' })
  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  error?: string;
}
