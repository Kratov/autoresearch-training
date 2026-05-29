import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExperimentsService } from './experiments.service';
import { CreateExperimentDto, UpdateExperimentDto } from './experiments.dto';
import { Experiment } from './experiment.entity';

@ApiTags('experiments')
@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all experiments' })
  @ApiResponse({ status: 200, description: 'List of all experiments' })
  async findAll(): Promise<Experiment[]> {
    return this.experimentsService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get experiment statistics' })
  async getStats() {
    return this.experimentsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get experiment by ID' })
  @ApiResponse({ status: 200, description: 'Experiment details' })
  @ApiResponse({ status: 404, description: 'Experiment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Experiment> {
    return this.experimentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new experiment' })
  @ApiResponse({ status: 201, description: 'Experiment created' })
  async create(@Body() dto: CreateExperimentDto): Promise<Experiment> {
    return this.experimentsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an experiment' })
  @ApiResponse({ status: 200, description: 'Experiment updated' })
  @ApiResponse({ status: 404, description: 'Experiment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperimentDto,
  ): Promise<Experiment> {
    return this.experimentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an experiment' })
  @ApiResponse({ status: 200, description: 'Experiment deleted' })
  @ApiResponse({ status: 404, description: 'Experiment not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.experimentsService.delete(id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all experiments (reset for demo)' })
  @ApiResponse({ status: 200, description: 'All experiments deleted' })
  async deleteAll(): Promise<{ deleted: number }> {
    return this.experimentsService.deleteAll();
  }
}
