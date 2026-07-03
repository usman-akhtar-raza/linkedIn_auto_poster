import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LinkedinModule } from '../linkedin/linkedin.module';
import { AnalyticsService } from './application/analytics.service';
import { AnalyticsController } from './presentation/analytics.controller';

@Module({
  imports: [HttpModule, LinkedinModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
