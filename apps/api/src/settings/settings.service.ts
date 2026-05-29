import { Injectable } from '@nestjs/common';

export interface TrainingSettings {
  // Model architecture
  n_layer: number;
  n_head: number;
  n_embd: number;
  block_size: number;
  dropout: number;

  // Training
  learning_rate: number;
  batch_size: number;
  max_iters: number;
  eval_interval: number;

  // Optimizer
  optimizer: 'adam' | 'adamw' | 'sgd';
  weight_decay: number;
  beta1: number;
  beta2: number;

  // Mode
  autoImprove: boolean;

  // Dataset
  dataset: string;
}

const DEFAULT_SETTINGS: TrainingSettings = {
  // Model architecture
  n_layer: 6,
  n_head: 6,
  n_embd: 384,
  block_size: 256,
  dropout: 0.2,

  // Training
  learning_rate: 3e-4,
  batch_size: 64,
  max_iters: 500,
  eval_interval: 50,

  // Optimizer
  optimizer: 'adamw',
  weight_decay: 0.1,
  beta1: 0.9,
  beta2: 0.99,

  // Mode
  autoImprove: false,

  // Dataset
  dataset: 'shakespeare',
};

@Injectable()
export class SettingsService {
  private settings: TrainingSettings = { ...DEFAULT_SETTINGS };

  getSettings(): TrainingSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<TrainingSettings>): TrainingSettings {
    this.settings = { ...this.settings, ...partial };
    return this.getSettings();
  }

  resetSettings(): TrainingSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    return this.getSettings();
  }

  getDefaults(): TrainingSettings {
    return { ...DEFAULT_SETTINGS };
  }

  getPresets(): Record<string, Partial<TrainingSettings>> {
    return {
      fast_demo: {
        n_layer: 4,
        n_head: 4,
        n_embd: 256,
        max_iters: 200,
        eval_interval: 25,
      },
      balanced: {
        n_layer: 6,
        n_head: 6,
        n_embd: 384,
        max_iters: 500,
        eval_interval: 50,
      },
      high_quality: {
        n_layer: 8,
        n_head: 8,
        n_embd: 512,
        max_iters: 1000,
        eval_interval: 100,
      },
      tiny: {
        n_layer: 2,
        n_head: 2,
        n_embd: 128,
        max_iters: 100,
        eval_interval: 20,
      },
    };
  }
}
