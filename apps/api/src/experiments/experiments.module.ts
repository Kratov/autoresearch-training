import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';
import { Experiment } from './experiment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Experiment])],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
