import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
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

  constructor(config: ConfigService) {
    this.connection = this.parseRedisUrl(config.getOrThrow<string>('REDIS_URL'));
    this.queues = Object.fromEntries(
      Object.values(QUEUE_NAMES).map((name) => [
        name,
        new Queue(name, { connection: this.connection }),
      ]),
    );
  }

  enqueueResearch(userId: string) {
    return this.getQueue(QUEUE_NAMES.research).add(
      JOB_NAMES.research,
      { userId },
      this.defaultOptions(),
    );
  }

  enqueueGeneratePost(userId: string, topic?: string) {
    return this.getQueue(QUEUE_NAMES.generatePost).add(
      JOB_NAMES.generatePost,
      { userId, topic },
      this.defaultOptions(),
    );
  }

  enqueueGenerateImage(userId: string, postId: string, prompt: string) {
    return this.getQueue(QUEUE_NAMES.generateImage).add(
      JOB_NAMES.generateImage,
      { userId, postId, prompt },
      this.defaultOptions(),
    );
  }

  enqueuePublishPost(userId: string, postId: string, delayMs = 0) {
    return this.getQueue(QUEUE_NAMES.publish).add(
      JOB_NAMES.publishPost,
      { userId, postId },
      this.defaultOptions(delayMs),
    );
  }

  enqueueAnalytics(userId: string, postId: string) {
    return this.getQueue(QUEUE_NAMES.analytics).add(
      JOB_NAMES.analytics,
      { userId, postId },
      this.defaultOptions(),
    );
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
