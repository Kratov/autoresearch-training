import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResearchService, ResearchMode, ResearchConfig } from './research.service';
import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UpdateModeDto {
  @ApiProperty({ description: 'Research mode to set' })
  @IsString()
  mode: ResearchMode;
}

class WorkerCallbackDto {
  @ApiProperty()
  @IsString()
  experimentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  log?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;
}

class GenerateTextDto {
  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ default: 0.8 })
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: 'Context/prefix to prepend to prompt' })
  @IsOptional()
  @IsString()
  context?: string;
}

class AutoresearchStartDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  maxIterations?: number;

  @ApiPropertyOptional({ default: 1.2 })
  @IsOptional()
  @IsNumber()
  targetLoss?: number;

  @ApiPropertyOptional({ description: 'Anthropic API key (or use env var)' })
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;
}

class UpdateProgramDto {
  @ApiProperty({ description: 'New program.md content' })
  @IsString()
  content: string;
}

@ApiTags('research')
@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get available research modes' })
  getConfig(): { available: ResearchConfig[]; current: ResearchConfig } {
    return {
      available: this.researchService.getAvailableModes(),
      current: this.researchService.getCurrentConfig(),
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Set research mode' })
  async setMode(@Body() dto: UpdateModeDto): Promise<ResearchConfig> {
    return this.researchService.setMode(dto.mode);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current research status' })
  getStatus() {
    return this.researchService.getStatus();
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a new research session' })
  @ApiResponse({ status: 201, description: 'Research started' })
  async start() {
    return this.researchService.start();
  }

  @Post('stop')
  @ApiOperation({ summary: 'Stop current research session' })
  async stop() {
    await this.researchService.stop();
    return { status: 'stopped' };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Callback endpoint for worker updates' })
  async workerCallback(@Body() dto: WorkerCallbackDto) {
    await this.researchService.handleWorkerUpdate(dto);
    return { received: true };
  }

  @Post('reset-optimizer')
  @ApiOperation({ summary: 'Reset the auto-improve optimizer state' })
  async resetOptimizer() {
    return this.researchService.resetOptimizer();
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate text from the trained model' })
  @ApiResponse({ status: 200, description: 'Generated text' })
  async generateText(@Body() dto: GenerateTextDto) {
    return this.researchService.generateText(dto.prompt, dto.maxTokens, dto.temperature, dto.context);
  }

  @Get('model-status')
  @ApiOperation({ summary: 'Check if a model is available for generation' })
  async getModelStatus() {
    return this.researchService.getModelStatus();
  }

  @Post('load-autoresearch-model')
  @ApiOperation({ summary: 'Load the autoresearch model for testing' })
  async loadAutoresearchModel() {
    return this.researchService.loadAutoresearchModel();
  }

  // Autoresearch endpoints

  @Post('autoresearch/start')
  @ApiOperation({ summary: 'Start the autoresearch agent loop' })
  async startAutoresearch(@Body() dto: AutoresearchStartDto) {
    return this.researchService.startAutoresearch(dto.maxIterations, dto.targetLoss, dto.anthropicApiKey);
  }

  @Post('autoresearch/stop')
  @ApiOperation({ summary: 'Stop the autoresearch agent' })
  async stopAutoresearch() {
    return this.researchService.stopAutoresearch();
  }

  @Get('autoresearch/status')
  @ApiOperation({ summary: 'Get autoresearch agent status' })
  async getAutoresearchStatus() {
    return this.researchService.getAutoresearchStatus();
  }

  @Get('autoresearch/program')
  @ApiOperation({ summary: 'Get program.md content' })
  async getProgram() {
    return this.researchService.getProgram();
  }

  @Put('autoresearch/program')
  @ApiOperation({ summary: 'Update program.md content' })
  async updateProgram(@Body() dto: UpdateProgramDto) {
    return this.researchService.updateProgram(dto.content);
  }

  @Get('autoresearch/train')
  @ApiOperation({ summary: 'Get train.py content' })
  async getTrainPy() {
    return this.researchService.getTrainPy();
  }
}
