import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SchedulerService } from './application/scheduler.service';
import { SchedulerController } from './presentation/scheduler.controller';

@Module({
  imports: [QueueModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
