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

type ChatOptions = {
  temperature?: number;
  model?: string;
  webSearch?: boolean;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<{
        type?: string;
        image_url?: { url?: string };
      }>;
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

  isMockMode() {
    return (
      !this.config.get<string>('OPENROUTER_API_KEY') &&
      this.config.get<string>('AI_MOCK') === 'true'
    );
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const apiKey = this.requireApiKey();
    if (!apiKey) {
      return this.developmentResponse(messages);
    }

    const model =
      options.model ?? this.config.getOrThrow<string>('OPENROUTER_MODEL');
    const data = await this.completions(apiKey, {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.webSearch ? { plugins: [{ id: 'web', max_results: 5 }] } : {}),
    });

    return data.choices?.[0]?.message?.content ?? '';
  }

  async generateImage(prompt: string): Promise<string> {
    const apiKey = this.requireApiKey();
    if (!apiKey) {
      return this.developmentImage(prompt);
    }

    const model =
      this.config.get<string>('OPENROUTER_IMAGE_MODEL') ??
      'google/gemini-2.5-flash-image';
    const data = await this.completions(apiKey, {
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    });

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      throw new ServiceUnavailableException(
        'OpenRouter returned no image for the prompt.',
      );
    }

    return imageUrl;
  }

  private async completions(
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<OpenRouterResponse> {
    const baseUrl = this.config.getOrThrow<string>('OPENROUTER_BASE_URL');

    try {
      const response = await firstValueFrom(
        this.http.post(`${baseUrl}/chat/completions`, body, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'AI LinkedIn Content Agent',
          },
        }),
      );

      return response.data as OpenRouterResponse;
    } catch (error) {
      // Never log the raw error: an Axios error carries
      // `config.headers.Authorization` (the OpenRouter API key). Log only the
      // safe status/message.
      this.logger.error(`OpenRouter request failed: ${this.describeError(error)}`);
      throw new ServiceUnavailableException('OpenRouter request failed.');
    }
  }

  private describeError(error: unknown): string {
    const axiosLike = error as {
      response?: { status?: number; statusText?: string };
      code?: string;
      message?: string;
    };
    if (axiosLike?.response?.status) {
      return `HTTP ${axiosLike.response.status} ${axiosLike.response.statusText ?? ''}`.trim();
    }
    if (axiosLike?.code) {
      return axiosLike.code;
    }
    return axiosLike?.message ?? 'unknown error';
  }

  private requireApiKey(): string | null {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (apiKey) {
      return apiKey;
    }

    if (this.config.get<string>('AI_MOCK') === 'true') {
      this.logger.warn(
        'AI_MOCK=true and OPENROUTER_API_KEY missing — returning canned mock output. Do not use in production.',
      );
      return null;
    }

    throw new ServiceUnavailableException(
      'OPENROUTER_API_KEY is not configured. Set it in backend/.env (or set AI_MOCK=true for local development with canned responses).',
    );
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

  private developmentImage(prompt: string) {
    const label = prompt.slice(0, 60).replace(/[^a-zA-Z0-9 .,-]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315"><rect width="100%" height="100%" fill="#e8eefc"/><text x="20" y="160" font-family="sans-serif" font-size="18" fill="#1d3a6e">Mock image: ${label}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}
