import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async chat(messages: ChatMessage[], temperature = 0.7): Promise<string> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY is missing. Returning deterministic development output.',
      );
      return this.developmentResponse(messages);
    }

    const baseUrl = this.config.getOrThrow<string>('OPENROUTER_BASE_URL');
    const model = this.config.getOrThrow<string>('OPENROUTER_MODEL');

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${baseUrl}/chat/completions`,
          { model, messages, temperature },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'AI LinkedIn Content Agent',
            },
          },
        ),
      );

      const data = response.data as OpenRouterResponse;
      return data.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      this.logger.error(error);
      throw new ServiceUnavailableException('OpenRouter request failed.');
    }
  }

  private developmentResponse(messages: ChatMessage[]) {
    const prompt = messages.map((message) => message.content).join('\n');
    return [
      'A practical engineering lesson:',
      '',
      'The strongest AI products are not built by chasing every new model release. They are built by turning one painful workflow into a repeatable system.',
      '',
      'For LinkedIn content, that means research, memory, draft quality, human approval, and publishing reliability all matter as much as the generated text.',
      '',
      'Question: where in your workflow would an agent save the most time without lowering quality?',
      '',
      `Context used: ${prompt.slice(0, 160)}`,
    ].join('\n');
  }
}
