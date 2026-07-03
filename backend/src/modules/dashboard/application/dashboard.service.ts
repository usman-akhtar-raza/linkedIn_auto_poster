import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../queue/application/queue.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async getOverview(userId: string) {
    const [recentPosts, todaysPost, queue, publishedCount, pendingCount] =
      await Promise.all([
        this.prisma.post.findMany({
          where: { userId },
          include: { analytics: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        this.prisma.post.findFirst({
          where: {
            userId,
            scheduledFor: { gte: new Date(new Date().toDateString()) },
          },
          orderBy: { scheduledFor: 'asc' },
        }),
        this.queue.getStatus(),
        this.prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
        this.prisma.post.count({
          where: { userId, status: 'PENDING_APPROVAL' },
        }),
      ]);

    return { recentPosts, todaysPost, queue, publishedCount, pendingCount };
  }
}
