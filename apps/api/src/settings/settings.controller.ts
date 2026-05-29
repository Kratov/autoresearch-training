import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService, TrainingSettings } from './settings.service';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Number of transformer layers', minimum: 1, maximum: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  n_layer?: number;

  @ApiPropertyOptional({ description: 'Number of attention heads', minimum: 1, maximum: 16 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(16)
  n_head?: number;

  @ApiPropertyOptional({ description: 'Embedding dimension', minimum: 64, maximum: 1024 })
  @IsOptional()
  @IsNumber()
  @Min(64)
  @Max(1024)
  n_embd?: number;

  @ApiPropertyOptional({ description: 'Context length', minimum: 32, maximum: 1024 })
  @IsOptional()
  @IsNumber()
  @Min(32)
  @Max(1024)
  block_size?: number;

  @ApiPropertyOptional({ description: 'Dropout rate', minimum: 0, maximum: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  dropout?: number;

  @ApiPropertyOptional({ description: 'Learning rate', minimum: 0.000001, maximum: 0.1 })
  @IsOptional()
  @IsNumber()
  learning_rate?: number;

  @ApiPropertyOptional({ description: 'Batch size', minimum: 1, maximum: 256 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(256)
  batch_size?: number;

  @ApiPropertyOptional({ description: 'Maximum training iterations', minimum: 10, maximum: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  max_iters?: number;

  @ApiPropertyOptional({ description: 'Evaluation interval', minimum: 5, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(500)
  eval_interval?: number;

  @ApiPropertyOptional({ description: 'Optimizer type', enum: ['adam', 'adamw', 'sgd'] })
  @IsOptional()
  @IsString()
  optimizer?: 'adam' | 'adamw' | 'sgd';

  @ApiPropertyOptional({ description: 'Weight decay', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight_decay?: number;

  @ApiPropertyOptional({ description: 'Adam beta1', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  beta1?: number;

  @ApiPropertyOptional({ description: 'Adam beta2', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  beta2?: number;
}

class ApplyPresetDto {
  @ApiPropertyOptional({ description: 'Preset name' })
  @IsString()
  preset: string;
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current training settings' })
  getSettings(): TrainingSettings {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Update training settings' })
  updateSettings(@Body() dto: UpdateSettingsDto): TrainingSettings {
    return this.settingsService.updateSettings(dto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset settings to defaults' })
  resetSettings(): TrainingSettings {
    return this.settingsService.resetSettings();
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Get default settings' })
  getDefaults(): TrainingSettings {
    return this.settingsService.getDefaults();
  }

  @Get('presets')
  @ApiOperation({ summary: 'Get available presets' })
  getPresets(): Record<string, Partial<TrainingSettings>> {
    return this.settingsService.getPresets();
  }

  @Post('preset')
  @ApiOperation({ summary: 'Apply a preset' })
  applyPreset(@Body() dto: ApplyPresetDto): TrainingSettings {
    const presets = this.settingsService.getPresets();
    const preset = presets[dto.preset];
    if (preset) {
      return this.settingsService.updateSettings(preset);
    }
    return this.settingsService.getSettings();
  }
}
