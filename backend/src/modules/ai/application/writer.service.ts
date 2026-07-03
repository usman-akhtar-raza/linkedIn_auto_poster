import { Injectable } from '@nestjs/common';
import { OpenRouterClient } from '../infrastructure/openrouter.client';
import { PromptTemplateService } from '../../prompts/application/prompt-template.service';
import { MemoryService } from '../../memory/application/memory.service';

@Injectable()
export class WriterService {
  constructor(
    private readonly openRouter: OpenRouterClient,
    private readonly prompts: PromptTemplateService,
    private readonly memory: MemoryService,
  ) {}

  async generatePost(input: {
    userId: string;
    topic: string;
    audience?: string[];
  }) {
    const template = await this.prompts.getDefaultTemplate(input.userId);
    const memory = await this.memory.getWritingMemory(input.userId);
    const userPrompt = template.userPrompt
      .replace('{{topic}}', input.topic)
      .replace(
        '{{targetAudience}}',
        input.audience?.join(', ') ?? 'Software Engineers, Founders, CTOs',
      );

    return this.openRouter.chat([
      {
        role: 'system',
        content: `${template.systemPrompt}\n\nMemory:\n${memory}`,
      },
      { role: 'user', content: userPrompt },
    ]);
  }
}
