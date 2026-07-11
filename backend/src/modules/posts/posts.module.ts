import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { LinkedinModule } from '../linkedin/linkedin.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ImagesModule } from '../images/images.module';
import { PostsService } from './application/posts.service';
import { PostsController } from './presentation/posts.controller';

@Module({
  imports: [AiModule, LinkedinModule, AnalyticsModule, ImagesModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
