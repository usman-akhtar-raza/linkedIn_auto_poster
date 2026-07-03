import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { QueueService } from './modules/queue/application/queue.service';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(cookieParser());
  const csrfMiddleware = app.get(CsrfMiddleware);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (shouldSkipCsrf(request)) {
      next();
      return;
    }

    csrfMiddleware.use(request, response, next);
  });
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('AI LinkedIn Content Agent')
    .setDescription(
      'Research, generate, approve, publish, and analyze LinkedIn content.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const queueService = app.get(QueueService);
  createBullBoard({
    queues: queueService.getQueues().map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();

function shouldSkipCsrf(request: Request) {
  const safePath = request.path.replace(/\/$/, '');
  const method = request.method.toUpperCase();

  return (
    safePath === '/health' ||
    safePath === '/readiness' ||
    safePath === '/liveness' ||
    (method === 'POST' && safePath === '/api/auth/signin') ||
    (method === 'POST' && safePath === '/api/auth/signup') ||
    (method === 'GET' && safePath === '/api/linkedin/oauth/callback')
  );
}
