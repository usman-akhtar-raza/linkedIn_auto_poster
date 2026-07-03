import { Injectable } from '@nestjs/common';

export type ResearchTopic = {
  title: string;
  source: string;
  url?: string;
  summary: string;
  score: number;
  tags: string[];
};

@Injectable()
export class ResearchService {
  searchLatestTrends(): ResearchTopic[] {
    return [
      {
        title: 'AI agents are moving from demos to workflow ownership',
        source: 'internal-research-plan',
        summary:
          'Teams are evaluating agents by measurable workflow outcomes: draft quality, approval cycle time, and reliable execution.',
        score: 0.94,
        tags: ['ai', 'agents', 'workflow'],
      },
      {
        title:
          'SaaS teams are consolidating content operations around automation',
        source: 'internal-research-plan',
        summary:
          'Small teams want repeatable content engines that preserve founder voice and reduce manual coordination.',
        score: 0.88,
        tags: ['saas', 'startup', 'content'],
      },
      {
        title:
          'React applications increasingly separate server and client concerns',
        source: 'internal-research-plan',
        summary:
          'Modern React architecture rewards clean boundaries, streaming data, and minimal client-side state.',
        score: 0.82,
        tags: ['react', 'frontend', 'architecture'],
      },
    ];
  }
}
