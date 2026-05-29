import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  size: string;
  source: 'predefined' | 'custom';
  downloaded: boolean;
  charCount?: number;
}

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async listDatasets(): Promise<{ datasets: Dataset[] }> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${workerUrl}/datasets`),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to list datasets:', error);
      return { datasets: [] };
    }
  }

  async downloadDataset(datasetId: string): Promise<Record<string, unknown>> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${workerUrl}/datasets/download/${datasetId}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to download dataset:', error);
      return { error: 'Failed to download dataset' };
    }
  }

  async uploadDataset(file: Express.Multer.File): Promise<Record<string, unknown>> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await firstValueFrom(
        this.httpService.post(`${workerUrl}/datasets/upload`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to upload dataset:', error);
      return { error: 'Failed to upload dataset' };
    }
  }

  async deleteDataset(datasetId: string): Promise<Record<string, unknown>> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${workerUrl}/datasets/${datasetId}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to delete dataset:', error);
      return { error: 'Failed to delete dataset' };
    }
  }

  async previewDataset(
    datasetId: string,
    maxChars?: number,
  ): Promise<Record<string, unknown>> {
    const workerUrl = this.configService.get('WORKER_URL', 'http://localhost:8000');
    try {
      const params = maxChars ? `?max_chars=${maxChars}` : '';
      const response = await firstValueFrom(
        this.httpService.get(`${workerUrl}/datasets/${datasetId}/preview${params}`),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to preview dataset:', error);
      return { error: 'Failed to preview dataset' };
    }
  }
}
