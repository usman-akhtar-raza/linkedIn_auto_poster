import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AnalyticsService } from '../../analytics/application/analytics.service';
import { ResearchService } from '../../ai/application/research.service';
import { ImagesService } from '../../images/application/images.service';
import { JobsService } from '../../jobs/application/jobs.service';
import { PostsService } from '../../posts/application/posts.service';
import { TopicsService } from '../../topics/application/topics.service';
import { JOB_NAMES, QUEUE_NAMES } from '../domain/job-names';
import { QueueService } from './queue.service';

type UserJob = { userId: string };
type GeneratePostJob = UserJob & { topic?: string };
type GenerateImageJob = UserJob & { postId: string; prompt: string };
type PublishJob = UserJob & { postId: string };

@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private readonly workers: Worker[] = [];

  constructor(
    private readonly queues: QueueService,
    private readonly research: ResearchService,
    private readonly topics: TopicsService,
    private readonly posts: PostsService,
    private readonly images: ImagesService,
    private readonly analytics: AnalyticsService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit() {
    this.registerWorker(QUEUE_NAMES.research, (job) => this.handleResearch(job as Job<UserJob>), 3);
    this.registerWorker(
      QUEUE_NAMES.generatePost,
      (job) => this.handleGeneratePost(job as Job<GeneratePostJob>),
      2,
    );
    this.registerWorker(
      QUEUE_NAMES.generateImage,
      (job) => this.handleGenerateImage(job as Job<GenerateImageJob>),
      2,
    );
    this.registerWorker(
      QUEUE_NAMES.publish,
      (job) => this.handlePublish(job as Job<PublishJob>),
      1,
    );
    this.registerWorker(
      QUEUE_NAMES.analytics,
      (job) => this.handleAnalytics(job as Job<PublishJob>),
      2,
    );
    this.registerWorker(QUEUE_NAMES.retry, async (job) => {
      await job.updateProgress(100);
      return { accepted: true };
    }, 1);
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<unknown>,
    concurrency: number,
  ) {
    const worker = new Worker(
      queueName,
      async (job) => {
        await this.jobs.markRunning(String(job.id)).catch(() => undefined);
        return processor(job);
      },
      {
        connection: this.queues.getConnection(),
        concurrency,
      },
    );

    worker.on('completed', (job) => {
      this.logger.log(`Queue job completed queue=${queueName} jobId=${job.id}`);
      void this.jobs.markCompleted(String(job.id)).catch(() => undefined);
    });
    worker.on('failed', (job, error) => {
      this.logger.error(
        `Queue job failed queue=${queueName} jobId=${job?.id} attempts=${job?.attemptsMade} error=${error.message}`,
      );
      const exhausted = !!job && job.attemptsMade >= (job.opts.attempts ?? 1);
      if (job) {
        void this.jobs
          .markFailed(String(job.id), error.message, job.attemptsMade, exhausted)
          .catch(() => undefined);
      }
      if (exhausted) {
        void this.queues.enqueueRetry({
          queueName,
          jobName: job.name,
          jobId: job.id,
          data: job.data as Record<string, unknown>,
          failedReason: error.message,
        });
      }
    });
    this.workers.push(worker);
  }

  private async handleResearch(job: Job<UserJob>) {
    await job.updateProgress(10);
    const topics = await this.research.searchLatestTrends();
    await job.updateProgress(60);
    await this.topics.saveMany(job.data.userId, topics);
    await job.updateProgress(100);
    return { topics: topics.length };
  }

  private async handleGeneratePost(job: Job<GeneratePostJob>) {
    await job.updateProgress(25);
    const topic = job.data.topic ?? (await this.pickTopic(job.data.userId));
    const post = await this.posts.generateDraft(job.data.userId, { topic });
    await job.updateProgress(100);
    return { postId: post.id };
  }

  private async pickTopic(userId: string) {
    const recent = await this.topics.latestForUser(userId);
    if (recent) {
      return recent.title;
    }

    const topics = await this.research.searchLatestTrends();
    await this.topics.saveMany(userId, topics);
    return topics.sort((a, b) => b.score - a.score)[0].title;
  }

  private async handleGenerateImage(job: Job<GenerateImageJob>) {
    await job.updateProgress(50);
    const image = await this.images.generateForPost(
      job.data.postId,
      job.data.prompt,
    );
    await job.updateProgress(100);
    return { imageId: image?.id };
  }

  private async handlePublish(job: Job<PublishJob>) {
    await job.updateProgress(20);
    const post = await this.posts.publish(job.data.userId, job.data.postId);
    await this.queues.enqueueAnalytics(job.data.userId, job.data.postId);
    await job.updateProgress(100);
    return { postId: post.id };
  }

  private async handleAnalytics(job: Job<PublishJob>) {
    await job.updateProgress(50);
    await this.analytics.collectFromLinkedIn(job.data.userId, job.data.postId);
    await job.updateProgress(100);
    return { postId: job.data.postId };
  }
}
