import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';
import { DateTime } from 'luxon';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../queue/application/queue.service';

type ScheduleFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'WEEKDAYS'
  | 'WEEKENDS'
  | 'SPECIFIC_DATES'
  | 'CUSTOM_CRON';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async updateSchedule(
    userId: string,
    data: {
      scheduleFrequency: ScheduleFrequency;
      scheduleCron?: string;
      scheduleDates?: Date[];
      timezone?: string;
      scheduleTime?: string;
    },
  ) {
    const nextScheduledRunAt = this.computeNextRun({
      frequency: data.scheduleFrequency,
      cron: data.scheduleCron,
      dates: data.scheduleDates,
      timezone: data.timezone ?? 'UTC',
      scheduleTime: data.scheduleTime ?? '09:00',
      from: new Date(),
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { ...data, nextScheduledRunAt },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueUsers() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { nextScheduledRunAt: { lte: now } },
          {
            nextScheduledRunAt: null,
            scheduleFrequency: {
              in: [
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'WEEKDAYS',
                'WEEKENDS',
                'SPECIFIC_DATES',
                'CUSTOM_CRON',
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        scheduleFrequency: true,
        scheduleCron: true,
        scheduleDates: true,
        scheduleTime: true,
        timezone: true,
        nextScheduledRunAt: true,
      },
      take: 100,
    });

    await Promise.all(
      users.map(async (user) => {
        const due =
          !user.nextScheduledRunAt ||
          user.nextScheduledRunAt.getTime() <= now.getTime();
        if (!due) {
          return;
        }

        await this.queue.enqueueGeneratePost(user.id);
        const nextScheduledRunAt = this.computeNextRun({
          frequency: user.scheduleFrequency,
          cron: user.scheduleCron ?? undefined,
          dates: user.scheduleDates,
          timezone: user.timezone,
          scheduleTime: user.scheduleTime,
          from: now,
        });
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastScheduleRunAt: now, nextScheduledRunAt },
        });
      }),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueScheduledPosts() {
    const now = new Date();
    const posts = await this.prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: now },
      },
      select: {
        id: true,
        userId: true,
        scheduledFor: true,
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });

    await Promise.all(
      posts.map(async (post) => {
        const claimed = await this.prisma.post.updateMany({
          where: {
            id: post.id,
            status: 'SCHEDULED',
            scheduledFor: { lte: now },
          },
          data: { status: 'APPROVED' },
        });

        if (claimed.count !== 1) {
          return;
        }

        const job = await this.queue.enqueuePublishPost(post.userId, post.id);
        await this.prisma.job.create({
          data: {
            userId: post.userId,
            postId: post.id,
            queueJobId: String(job.id),
            type: 'PUBLISH_POST',
            status: 'QUEUED',
            scheduledFor: post.scheduledFor,
            payload: { source: 'scheduled-post-publisher' },
          },
        });
      }),
    );
  }

  recoverMissedJobs() {
    return Promise.all([
      this.enqueueDueUsers(),
      this.enqueueDueScheduledPosts(),
    ]);
  }

  private computeNextRun(input: {
    frequency: ScheduleFrequency;
    cron?: string;
    dates?: Date[];
    timezone: string;
    scheduleTime: string;
    from: Date;
  }) {
    const from = DateTime.fromJSDate(input.from).setZone(input.timezone);
    const [hour = 9, minute = 0] = input.scheduleTime
      .split(':')
      .map((part) => Number(part));

    if (input.frequency === 'CUSTOM_CRON' && input.cron) {
      return CronExpressionParser.parse(input.cron, {
        currentDate: input.from,
        tz: input.timezone,
      })
        .next()
        .toDate();
    }

    if (input.frequency === 'SPECIFIC_DATES') {
      return (
        input.dates
          ?.filter((date) => date.getTime() > input.from.getTime())
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
      );
    }

    let candidate = from.set({ hour, minute, second: 0, millisecond: 0 });
    if (candidate <= from) {
      candidate = candidate.plus({ days: 1 });
    }

    while (!this.matchesFrequency(candidate, input.frequency)) {
      candidate = candidate.plus({ days: 1 });
    }

    return candidate.toUTC().toJSDate();
  }

  private matchesFrequency(value: DateTime, frequency: ScheduleFrequency) {
    if (frequency === 'DAILY') {
      return true;
    }
    if (frequency === 'WEEKLY') {
      return value.weekday === 1;
    }
    if (frequency === 'MONTHLY') {
      return value.day === 1;
    }
    if (frequency === 'WEEKDAYS') {
      return value.weekday >= 1 && value.weekday <= 5;
    }
    if (frequency === 'WEEKENDS') {
      return value.weekday === 6 || value.weekday === 7;
    }
    return false;
  }
}
