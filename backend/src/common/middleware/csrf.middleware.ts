import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, response: Response, next: NextFunction) {
    if (SAFE_METHODS.has(request.method)) {
      const token = this.sign(this.getSessionSeed(request));
      response.cookie('csrf_token', token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      next();
      return;
    }

    const headerToken = request.header('x-csrf-token');
    const cookieToken = request.cookies?.csrf_token as string | undefined;

    if (!headerToken || !cookieToken || !this.matches(headerToken, cookieToken)) {
      throw new ForbiddenException('Invalid CSRF token.');
    }

    next();
  }

  private getSessionSeed(request: Request) {
    return request.header('authorization') ?? request.ip ?? 'anonymous';
  }

  private sign(seed: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('CSRF_SECRET'))
      .update(seed)
      .digest('base64url');
  }

  private matches(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
