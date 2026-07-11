import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ResearchTopic } from '../../ai/application/research.service';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  latestForUser(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.prisma.topic.findFirst({
      where: { userId, researchedAt: { gte: since } },
      orderBy: [{ score: 'desc' }, { researchedAt: 'desc' }],
    });
  }

  saveMany(userId: string, topics: ResearchTopic[]) {
    return Promise.all(
      topics.map((topic) =>
        this.prisma.topic.create({
          data: { ...topic, userId },
        }),
      ),
    );
  }
}
