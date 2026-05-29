import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experiment, ExperimentStatus } from './experiment.entity';
import { CreateExperimentDto, UpdateExperimentDto } from './experiments.dto';

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectRepository(Experiment)
    private experimentsRepository: Repository<Experiment>,
  ) {}

  async findAll(): Promise<Experiment[]> {
    return this.experimentsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Experiment> {
    const experiment = await this.experimentsRepository.findOne({
      where: { id },
    });
    if (!experiment) {
      throw new NotFoundException(`Experiment ${id} not found`);
    }
    return experiment;
  }

  async create(dto: CreateExperimentDto): Promise<Experiment> {
    const experiment = this.experimentsRepository.create({
      name: dto.name,
      mode: dto.mode,
      config: dto.config || {},
      status: 'pending',
    });
    return this.experimentsRepository.save(experiment);
  }

  async update(id: string, dto: UpdateExperimentDto): Promise<Experiment> {
    const experiment = await this.findOne(id);

    if (dto.status) {
      experiment.status = dto.status;
      if (dto.status === 'completed' || dto.status === 'failed') {
        experiment.completedAt = new Date();
      }
    }

    if (dto.metrics) {
      experiment.metrics = { ...experiment.metrics, ...dto.metrics };
    }

    if (dto.error) {
      experiment.error = dto.error;
    }

    return this.experimentsRepository.save(experiment);
  }

  async updateStatus(id: string, status: ExperimentStatus): Promise<Experiment> {
    return this.update(id, { status });
  }

  async updateMetrics(
    id: string,
    metrics: Record<string, unknown>,
  ): Promise<Experiment> {
    return this.update(id, { metrics });
  }

  async delete(id: string): Promise<void> {
    const result = await this.experimentsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Experiment ${id} not found`);
    }
  }

  async deleteAll(): Promise<{ deleted: number }> {
    const count = await this.experimentsRepository.count();
    if (count > 0) {
      await this.experimentsRepository.clear();
    }
    return { deleted: count };
  }

  async getStats() {
    const experiments = await this.findAll();
    return {
      total: experiments.length,
      completed: experiments.filter((e) => e.status === 'completed').length,
      running: experiments.filter((e) => e.status === 'running').length,
      failed: experiments.filter((e) => e.status === 'failed').length,
      pending: experiments.filter((e) => e.status === 'pending').length,
    };
  }
}
