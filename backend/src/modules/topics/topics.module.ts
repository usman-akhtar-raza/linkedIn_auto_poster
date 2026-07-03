import { Module } from '@nestjs/common';
import { TopicsService } from './application/topics.service';

@Module({
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
