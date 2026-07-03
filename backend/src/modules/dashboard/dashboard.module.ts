import { Module } from '@nestjs/common';
import { DashboardController } from './presentation/dashboard.controller';
import { DashboardService } from './application/dashboard.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
