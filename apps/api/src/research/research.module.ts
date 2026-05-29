import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
import { ExperimentsModule } from '../experiments/experiments.module';
import { EventsModule } from '../events/events.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [HttpModule, ExperimentsModule, EventsModule, SettingsModule],
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
