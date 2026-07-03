import { Module } from '@nestjs/common';
import { PromptTemplateService } from './application/prompt-template.service';
import { PromptsController } from './presentation/prompts.controller';

@Module({
  controllers: [PromptsController],
  providers: [PromptTemplateService],
  exports: [PromptTemplateService],
})
export class PromptsModule {}
