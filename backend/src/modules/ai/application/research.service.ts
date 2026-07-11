import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sanitizeHttpUrl } from '../../../common/security/safe-url';
import { OpenRouterClient } from '../infrastructure/openrouter.client';

export type ResearchTopic = {
  title: string;
  source: string;
  url?: string;
  summary: string;
  score: number;
  tags: string[];
};

const RESEARCH_SYSTEM_PROMPT = [
  'You are a research analyst finding timely, high-signal topics for LinkedIn posts',
  'aimed at software engineers, SaaS founders, and AI practitioners.',
  'Use the web search results provided to you to find what is trending right now.',
  'Respond with ONLY a JSON array (no prose, no markdown fences) of 3 to 5 objects,',
  'each shaped exactly like:',
  '{"title": string, "source": string, "url": string, "summary": string, "score": number between 0 and 1, "tags": string[]}',
  'The score reflects how likely the topic is to perform well on LinkedIn this week.',
].join(' ');

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(private readonly openRouter: OpenRouterClient) {}

  async searchLatestTrends(): Promise<ResearchTopic[]> {
    if (this.openRouter.isMockMode()) {
      return this.mockTopics();
    }

    const raw = await this.openRouter.chat(
      [
        { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            'Find the most discussed topics from the last 7 days in AI engineering, SaaS, and software development that would make strong LinkedIn posts.',
        },
      ],
      { temperature: 0.4, webSearch: true },
    );

    return this.parseTopics(raw);
  }

  private parseTopics(raw: string): ResearchTopic[] {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) {
      this.logger.error(
        `Research response was not a JSON array: ${raw.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        'Research returned an unparseable response.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      this.logger.error(
        `Research response failed JSON.parse: ${raw.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException('Research returned invalid JSON.');
    }

    if (!Array.isArray(parsed)) {
      throw new ServiceUnavailableException('Research returned invalid JSON.');
    }

    const topics = parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .map((item) => ({
        title: String(item.title ?? '').slice(0, 300),
        source: String(item.source ?? 'web-research'),
        url: sanitizeHttpUrl(item.url),
        summary: String(item.summary ?? ''),
        score: this.clampScore(item.score),
        tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : [],
      }))
      .filter((topic) => topic.title && topic.summary);

    if (topics.length === 0) {
      throw new ServiceUnavailableException(
        'Research returned no usable topics.',
      );
    }

    return topics;
  }

  private clampScore(value: unknown) {
    const score = Number(value);
    if (Number.isNaN(score)) {
      return 0.5;
    }
    return Math.min(1, Math.max(0, score));
  }

  private mockTopics(): ResearchTopic[] {
    return [
      {
        title: 'AI agents are moving from demos to workflow ownership',
        source: 'mock-research',
        summary:
          'Teams are evaluating agents by measurable workflow outcomes: draft quality, approval cycle time, and reliable execution.',
        score: 0.94,
        tags: ['ai', 'agents', 'workflow'],
      },
      {
        title:
          'SaaS teams are consolidating content operations around automation',
        source: 'mock-research',
        summary:
          'Small teams want repeatable content engines that preserve founder voice and reduce manual coordination.',
        score: 0.88,
        tags: ['saas', 'startup', 'content'],
      },
      {
        title:
          'React applications increasingly separate server and client concerns',
        source: 'mock-research',
        summary:
          'Modern React architecture rewards clean boundaries, streaming data, and minimal client-side state.',
        score: 0.82,
        tags: ['react', 'frontend', 'architecture'],
      },
    ];
  }
}
