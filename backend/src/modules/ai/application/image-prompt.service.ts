import { Injectable } from '@nestjs/common';
import { OpenRouterClient } from '../infrastructure/openrouter.client';

@Injectable()
export class ImagePromptService {
  constructor(private readonly openRouter: OpenRouterClient) {}

  async createPrompt(topic: string, post: string) {
    return this.openRouter.chat(
      [
        {
          role: 'system',
          content:
            'Create concise image generation prompts for professional LinkedIn posts. Avoid text-heavy layouts, logos, and copyrighted characters.',
        },
        {
          role: 'user',
          content: `Topic: ${topic}\nPost:\n${post}\nReturn one production-ready visual prompt.`,
        },
      ],
      0.5,
    );
  }
}
