import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type JobType =
  | 'RESEARCH'
  | 'GENERATE_POST'
  | 'GENERATE_IMAGE'
  | 'PUBLISH_POST'
  | 'ANALYTICS';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    userId: string,
    data: {
      type: JobType;
      payload?: object;
      queueJobId?: string;
      postId?: string;
      scheduledFor?: Date | null;
    },
  ) {
    return this.prisma.job.create({
      data: {
        userId,
        type: data.type,
        payload: data.payload ?? {},
        queueJobId: data.queueJobId,
        postId: data.postId,
        scheduledFor: data.scheduledFor ?? undefined,
      },
    });
  }

  markRunning(queueJobId: string) {
    return this.prisma.job.updateMany({
      where: { queueJobId, status: { in: ['QUEUED', 'RETRYING'] } },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  markCompleted(queueJobId: string) {
    return this.prisma.job.updateMany({
      where: { queueJobId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  markFailed(queueJobId: string, error: string, attempts: number, final: boolean) {
    return this.prisma.job.updateMany({
      where: { queueJobId },
      data: {
        status: final ? 'FAILED' : 'RETRYING',
        error: error.slice(0, 2000),
        attempts,
        ...(final ? { completedAt: new Date() } : {}),
      },
    });
  }
}
