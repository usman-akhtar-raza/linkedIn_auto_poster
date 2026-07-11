import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ImagesService } from './application/images.service';

@Module({
  imports: [AiModule],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
