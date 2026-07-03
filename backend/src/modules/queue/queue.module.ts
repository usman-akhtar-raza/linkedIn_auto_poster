import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ImagesModule } from '../images/images.module';
import { PostsModule } from '../posts/posts.module';
import { TopicsModule } from '../topics/topics.module';
import { QueueService } from './application/queue.service';
import { QueueWorkerService } from './application/queue-worker.service';
import { QueueController } from './presentation/queue.controller';

@Module({
  imports: [AiModule, PostsModule, AnalyticsModule, ImagesModule, TopicsModule],
  controllers: [QueueController],
  providers: [QueueService, QueueWorkerService],
  exports: [QueueService],
})
export class QueueModule {}
