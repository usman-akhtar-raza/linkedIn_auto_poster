import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { JobsOptions, Queue } from 'bullmq';
import { JobsService, JobType } from '../../jobs/application/jobs.service';
import { JOB_NAMES, QUEUE_NAMES } from '../domain/job-names';

export type QueueConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: QueueConnectionOptions;
  private readonly queues: Record<string, Queue>;

  constructor(
    config: ConfigService,
    private readonly jobs: JobsService,
  ) {
    this.connection = this.parseRedisUrl(config.getOrThrow<string>('REDIS_URL'));
    this.queues = Object.fromEntries(
      Object.values(QUEUE_NAMES).map((name) => [
        name,
        new Queue(name, { connection: this.connection }),
      ]),
    );
  }

  enqueueResearch(userId: string) {
    return this.enqueueTracked({
      queueName: QUEUE_NAMES.research,
      jobName: JOB_NAMES.research,
      data: { userId },
      userId,
      type: 'RESEARCH',
    });
  }

  enqueueGeneratePost(userId: string, topic?: string) {
    return this.enqueueTracked({
      queueName: QUEUE_NAMES.generatePost,
      jobName: JOB_NAMES.generatePost,
      data: { userId, topic },
      userId,
      type: 'GENERATE_POST',
      payload: topic ? { topic } : {},
    });
  }

  enqueueGenerateImage(userId: string, postId: string, prompt: string) {
    return this.enqueueTracked({
      queueName: QUEUE_NAMES.generateImage,
      jobName: JOB_NAMES.generateImage,
      data: { userId, postId, prompt },
      userId,
      type: 'GENERATE_IMAGE',
      postId,
      payload: { prompt },
    });
  }

  enqueuePublishPost(
    userId: string,
    postId: string,
    delayMs = 0,
    meta: { scheduledFor?: Date | null; source?: string } = {},
  ) {
    return this.enqueueTracked({
      queueName: QUEUE_NAMES.publish,
      jobName: JOB_NAMES.publishPost,
      data: { userId, postId },
      userId,
      type: 'PUBLISH_POST',
      postId,
      delayMs,
      scheduledFor: meta.scheduledFor,
      payload: meta.source ? { source: meta.source } : {},
    });
  }

  enqueueAnalytics(userId: string, postId: string) {
    return this.enqueueTracked({
      queueName: QUEUE_NAMES.analytics,
      jobName: JOB_NAMES.analytics,
      data: { userId, postId },
      userId,
      type: 'ANALYTICS',
      postId,
    });
  }

  // Records the Job row BEFORE enqueuing, using a globally-unique id as the
  // BullMQ jobId. This fixes two bugs: (1) BullMQ job ids are per-queue
  // counters, so a bare `job.id` collides across queues and the worker's
  // status updates hit the wrong row — a UUID is unique across all queues;
  // (2) creating the row first means a worker can never run before its Job
  // row exists (which previously left the row stuck at QUEUED).
  private async enqueueTracked(input: {
    queueName: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
    jobName: string;
    data: Record<string, unknown>;
    userId: string;
    type: JobType;
    postId?: string;
    payload?: object;
    scheduledFor?: Date | null;
    delayMs?: number;
  }) {
    const jobId = randomUUID();
    await this.jobs.record(input.userId, {
      type: input.type,
      queueJobId: jobId,
      postId: input.postId,
      payload: input.payload,
      scheduledFor: input.scheduledFor,
    });

    try {
      return await this.getQueue(input.queueName).add(input.jobName, input.data, {
        ...this.defaultOptions(input.delayMs ?? 0),
        jobId,
      });
    } catch (error) {
      await this.jobs
        .markFailed(jobId, (error as Error).message, 0, true)
        .catch(() => undefined);
      throw error;
    }
  }

  enqueueRetry(payload: Record<string, unknown>) {
    return this.getQueue(QUEUE_NAMES.retry).add(
      'DeadLetterJob',
      payload,
      this.defaultOptions(),
    );
  }

  async getStatus() {
    const entries = await Promise.all(
      Object.entries(this.queues).map(async ([name, queue]) => {
        const [waiting, active, completed, failed, delayed, paused] =
          await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.isPaused(),
          ]);

        return [name, { waiting, active, completed, failed, delayed, paused }];
      }),
    );

    return Object.fromEntries(entries);
  }

  async onModuleDestroy() {
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));
  }

  getConnection() {
    return this.connection;
  }

  getQueue(name: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]) {
    return this.queues[name];
  }

  getQueues() {
    return Object.values(this.queues);
  }

  private defaultOptions(delay = 0): JobsOptions {
    return {
      delay,
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    };
  }

  private parseRedisUrl(redisUrl: string): QueueConnectionOptions {
    const url = new URL(redisUrl);

    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  }
}
