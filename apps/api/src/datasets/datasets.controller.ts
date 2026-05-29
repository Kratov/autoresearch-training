import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DatasetsService } from './datasets.service';

@ApiTags('datasets')
@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available datasets' })
  async listDatasets() {
    return this.datasetsService.listDatasets();
  }

  @Post('download/:datasetId')
  @ApiOperation({ summary: 'Download a predefined dataset' })
  async downloadDataset(@Param('datasetId') datasetId: string) {
    return this.datasetsService.downloadDataset(datasetId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a custom dataset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataset(@UploadedFile() file: Express.Multer.File) {
    return this.datasetsService.uploadDataset(file);
  }

  @Delete(':datasetId')
  @ApiOperation({ summary: 'Delete a custom dataset' })
  async deleteDataset(@Param('datasetId') datasetId: string) {
    return this.datasetsService.deleteDataset(datasetId);
  }

  @Get(':datasetId/preview')
  @ApiOperation({ summary: 'Get a preview of a dataset' })
  async previewDataset(
    @Param('datasetId') datasetId: string,
    @Query('maxChars') maxChars?: number,
  ) {
    return this.datasetsService.previewDataset(datasetId, maxChars);
  }
}
