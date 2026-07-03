import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../queue/application/queue.service';

type ComponentStatus = {
  status: 'up' | 'down' | 'degraded';
  details?: Record<string, unknown>;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
  ) {}

  liveness() {
    return { status: 'up', timestamp: new Date().toISOString() };
  }

  async readiness() {
    const [database, redis, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
    ]);

    const openRouter = this.checkConfigured('OPENROUTER_API_KEY');
    const linkedIn = this.checkConfigured('LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET');
    const components = { database, redis, queues, openRouter, linkedIn };
    const status = Object.values(components).every((component) => component.status === 'up')
      ? 'up'
      : 'degraded';

    return { status, components, timestamp: new Date().toISOString() };
  }

  health() {
    return this.readiness();
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch {
      return { status: 'down' };
    } finally {
      redis.disconnect();
    }
  }

  private async checkQueues(): Promise<ComponentStatus> {
    try {
      const status = await this.queue.getStatus();
      return { status: 'up', details: status };
    } catch {
      return { status: 'down' };
    }
  }

  private checkConfigured(...keys: string[]): ComponentStatus {
    const configured = keys.every((key) => Boolean(this.config.get<string>(key)));
    return { status: configured ? 'up' : 'degraded' };
  }
}
