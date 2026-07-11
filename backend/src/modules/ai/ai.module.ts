import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MemoryModule } from '../memory/memory.module';
import { PromptsModule } from '../prompts/prompts.module';
import { AiController } from './presentation/ai.controller';
import { OpenRouterClient } from './infrastructure/openrouter.client';
import { ResearchService } from './application/research.service';
import { WriterService } from './application/writer.service';
import { EditorService } from './application/editor.service';
import { ImagePromptService } from './application/image-prompt.service';

@Module({
  imports: [HttpModule, MemoryModule, PromptsModule],
  controllers: [AiController],
  providers: [
    OpenRouterClient,
    ResearchService,
    WriterService,
    EditorService,
    ImagePromptService,
  ],
  exports: [
    OpenRouterClient,
    ResearchService,
    WriterService,
    EditorService,
    ImagePromptService,
  ],
})
export class AiModule {}
