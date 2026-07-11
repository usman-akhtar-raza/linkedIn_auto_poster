import { NestFactory } from '@nestjs/core';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
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

  // Swagger maps the entire attack surface; keep it out of production.
  if (process.env.NODE_ENV !== 'production') {
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
  }

  mountBullBoard(app);

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();

function mountBullBoard(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  const logger = new NestLogger('BullBoard');
  const user = process.env.BULL_BOARD_USER;
  const password = process.env.BULL_BOARD_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  if ((!user || !password) && isProduction) {
    logger.warn(
      'BULL_BOARD_USER/BULL_BOARD_PASSWORD not set — /admin/queues is disabled in production.',
    );
    return;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const queueService = app.get(QueueService);
  createBullBoard({
    queues: queueService.getQueues().map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  if (user && password) {
    app.use('/admin/queues', basicAuth('Bull Board', user, password));
  } else {
    logger.warn(
      'BULL_BOARD_USER/BULL_BOARD_PASSWORD not set — /admin/queues is exposed WITHOUT authentication (development only).',
    );
  }

  app.use('/admin/queues', serverAdapter.getRouter());
}

function basicAuth(realm: string, expectedUser: string, expectedPassword: string) {
  const safeEqual = (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  };

  return (request: Request, response: Response, next: NextFunction) => {
    const header = request.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');

    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPassword)) {
        next();
        return;
      }
    }

    response.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
    response.status(401).send('Authentication required.');
  };
}

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
