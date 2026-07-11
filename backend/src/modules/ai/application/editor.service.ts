import { Injectable } from '@nestjs/common';
import { OpenRouterClient } from '../infrastructure/openrouter.client';

@Injectable()
export class EditorService {
  constructor(private readonly openRouter: OpenRouterClient) {}

  async polish(content: string) {
    return this.openRouter.chat(
      [
        {
          role: 'system',
          content:
            'You are a strict LinkedIn editor. Improve grammar, remove repetition, keep the author voice human, remove AI clichés, and preserve factual claims.',
        },
        { role: 'user', content },
      ],
      { temperature: 0.3 },
    );
  }
}
