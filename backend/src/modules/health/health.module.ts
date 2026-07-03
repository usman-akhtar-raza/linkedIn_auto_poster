import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthService } from './application/health.service';
import { HealthController } from './presentation/health.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [HttpModule, QueueModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
