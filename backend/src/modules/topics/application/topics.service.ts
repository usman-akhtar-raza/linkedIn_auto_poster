import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ResearchTopic } from '../../ai/application/research.service';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

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
