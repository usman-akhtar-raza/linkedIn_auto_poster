import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Unexpected server error';

    if (status >= 500) {
      // Log only message + stack, never the raw exception object: Axios errors
      // serialize `config.headers.Authorization` (the OpenRouter key / LinkedIn
      // bearer token), which pino's redaction paths do not reach.
      const detail =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : 'Non-error thrown';
      this.logger.error(`Unhandled ${status} on ${request.method} ${request.url}: ${detail}`);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
