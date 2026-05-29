import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExperimentsModule } from './experiments/experiments.module';
import { ResearchModule } from './research/research.module';
import { EventsModule } from './events/events.module';
import { SettingsModule } from './settings/settings.module';
import { DatasetsModule } from './datasets/datasets.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: configService.get('DATABASE_PORT', 5432),
        username: configService.get('DATABASE_USER', 'autoresearch'),
        password: configService.get('DATABASE_PASSWORD', 'autoresearch_secret'),
        database: configService.get('DATABASE_NAME', 'autoresearch'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    ExperimentsModule,
    ResearchModule,
    EventsModule,
    SettingsModule,
    DatasetsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
