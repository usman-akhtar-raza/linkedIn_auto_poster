import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuditModule } from './common/audit/audit.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiModule } from './modules/ai/ai.module';
import { LinkedinModule } from './modules/linkedin/linkedin.module';
import { QueueModule } from './modules/queue/queue.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PostsModule } from './modules/posts/posts.module';
import { MemoryModule } from './modules/memory/memory.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { TopicsModule } from './modules/topics/topics.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ImagesModule } from './modules/images/images.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'accessToken',
            'refreshToken',
            '*.accessToken',
            '*.refreshToken',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    EncryptionModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AiModule,
    LinkedinModule,
    QueueModule,
    SchedulerModule,
    AnalyticsModule,
    PostsModule,
    MemoryModule,
    PromptsModule,
    TopicsModule,
    JobsModule,
    ImagesModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [CsrfMiddleware],
})
export class AppModule {}
