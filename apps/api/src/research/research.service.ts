import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExperimentsService } from '../experiments/experiments.service';
import { EventsGateway } from '../events/events.gateway';
import { SettingsService } from '../settings/settings.service';

export type ResearchMode =
  | 'hyperparameter'
  | 'architecture'
  | 'optimizer'
  | 'efficiency'
  | 'custom';

export interface ResearchConfig {
  mode: ResearchMode;
  description: string;
  parameters: Record<string, unknown>;
}

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);
  private currentMode: ResearchMode = 'hyperparameter';
  private isRunning = false;
  private currentExperimentId: string | null = null;

  private readonly availableModes: ResearchConfig[] = [
    {
      mode: 'hyperparameter',
      description: 'Learning rate, batch size, warmup - Quick parameter tuning',
      parameters: {
        learningRateRange: [1e-5, 1e-2],
        batchSizes: [16, 32, 64, 128],
        warmupSteps: [0, 100, 500, 1000],
      },
    },
    {
      mode: 'architecture',
      description: 'Layers, heads, embeddings - Model structure experiments',
      parameters: {
        numLayers: [2, 4, 6, 8, 12],
        numHeads: [4, 8, 12, 16],
        embeddingDims: [256, 512, 768, 1024],
      },
    },
    {
      mode: 'optimizer',
      description: 'AdamW, Muon, custom - Optimizer comparisons',
      parameters: {
        optimizers: ['adam', 'adamw', 'muon', 'sgd'],
        weightDecay: [0, 0.01, 0.1],
      },
    },
    {
      mode: 'efficiency',
      description: 'Speed, memory, convergence - Performance optimization',
      parameters: {
        gradientCheckpointing: [true, false],
        mixedPrecision: ['no', 'fp16', 'bf16'],
        compileMode: [false, true],
      },
    },
    {
      mode: 'custom',
      description: 'User-defined - Free-form research',
      parameters: {},
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly experimentsService: ExperimentsService,
    private readonly eventsGateway: EventsGateway,
    private readonly settingsService: SettingsService,
  ) {}

  getAvailableModes(): ResearchConfig[] {
    return this.availableModes;
  }

  getCurrentConfig(): ResearchConfig {
    return (
      this.availableModes.find((m) => m.mode === this.currentMode) ||
      this.availableModes[0]
    );
  }

  async setMode(mode: ResearchMode): Promise<ResearchConfig> {
    if (this.isRunning) {
      throw new Error('Cannot change mode while research is running');
    }

    const config = this.availableModes.find((m) => m.mode === mode);
    if (!config) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    this.currentMode = mode;
    this.logger.log(`Research mode set to: ${mode}`);
    return config;
  }

  async start(): Promise<{ experimentId: string }> {
    if (this.isRunning) {
      throw new Error('Research is already running');
    }

    // Get training settings
    const trainingSettings = this.settingsService.getSettings();

    const experiment = await this.experimentsService.create({
      name: `${this.currentMode}-${Date.now()}`,
      mode: this.currentMode,
      config: { ...this.getCurrentConfig().parameters, ...trainingSettings },
    });

    this.currentExperimentId = experiment.id;
    this.isRunning = true;

    this.eventsGateway.emit('research:started', { experimentId: experiment.id });
    this.eventsGateway.emit('experiment:created', experiment);

    await this.experimentsService.updateStatus(experiment.id, 'running');

    // Notify Python worker with training settings
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      await firstValueFrom(
        this.httpService.post(`${workerUrl}/run`, {
          experimentId: experiment.id,
          mode: this.currentMode,
          autoImprove: trainingSettings.autoImprove || false,
          config: {
            ...this.getCurrentConfig().parameters,
            ...trainingSettings,
            real_training: this.currentMode === 'custom',
          },
        }),
      );
      this.logger.log(`Started experiment ${experiment.id} with mode ${this.currentMode} (autoImprove: ${trainingSettings.autoImprove})`);
    } catch (error) {
      this.logger.error('Failed to start worker:', error);
      await this.experimentsService.update(experiment.id, {
        status: 'failed',
        error: 'Failed to connect to worker',
      });
      this.isRunning = false;
      throw new Error('Failed to start worker');
    }

    return { experimentId: experiment.id };
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      await firstValueFrom(this.httpService.post(`${workerUrl}/stop`));
    } catch (error) {
      this.logger.warn('Failed to stop worker:', error);
    }

    if (this.currentExperimentId) {
      await this.experimentsService.updateStatus(
        this.currentExperimentId,
        'completed',
      );
    }

    this.isRunning = false;
    this.currentExperimentId = null;
    this.eventsGateway.emit('research:stopped', {});
    this.logger.log('Research stopped');
  }

  async handleWorkerUpdate(data: {
    experimentId: string;
    status?: string;
    metrics?: Record<string, unknown>;
    log?: string;
    error?: string;
  }) {
    if (data.log) {
      this.eventsGateway.emit('log', data.log);
    }

    if (data.experimentId) {
      const update: Record<string, unknown> = {};
      if (data.metrics) update.metrics = data.metrics;
      if (data.status) update.status = data.status;
      if (data.error) update.error = data.error;

      if (Object.keys(update).length > 0) {
        const experiment = await this.experimentsService.update(
          data.experimentId,
          update,
        );
        this.eventsGateway.emit('experiment:updated', experiment);
      }

      if (data.status === 'completed' || data.status === 'failed') {
        this.isRunning = false;
        this.currentExperimentId = null;
        this.eventsGateway.emit('research:stopped', {});
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentMode: this.currentMode,
      currentExperimentId: this.currentExperimentId,
    };
  }

  async resetOptimizer(): Promise<{ status: string }> {
    if (this.isRunning) {
      throw new Error('Cannot reset optimizer while research is running');
    }

    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      await firstValueFrom(this.httpService.post(`${workerUrl}/optimizer/reset`));
      this.logger.log('Optimizer reset');
      return { status: 'reset' };
    } catch (error) {
      this.logger.warn('Failed to reset optimizer:', error);
      return { status: 'reset_attempted' };
    }
  }

  async generateText(
    prompt?: string,
    maxTokens?: number,
    temperature?: number,
    context?: string,
  ): Promise<{ text: string | null; error: string | null }> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${workerUrl}/generate`, {
          prompt: prompt || '',
          max_tokens: maxTokens || 200,
          temperature: temperature || 0.8,
          context: context || null,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to generate text:', error);
      return { text: null, error: 'Failed to connect to worker' };
    }
  }

  async getModelStatus(): Promise<{ has_model: boolean; is_training: boolean }> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${workerUrl}/model-status`),
      );
      return response.data;
    } catch (error) {
      this.logger.warn('Failed to get model status:', error);
      return { has_model: false, is_training: this.isRunning };
    }
  }
}
