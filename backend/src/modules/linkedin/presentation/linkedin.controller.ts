import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LinkedinOAuthService } from '../application/linkedin-oauth.service';

@ApiTags('linkedin')
@Controller('linkedin')
export class LinkedinController {
  constructor(
    private readonly oauth: LinkedinOAuthService,
    private readonly config: ConfigService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('oauth/url')
  getAuthorizationUrl(@CurrentUser() user: { userId: string }) {
    return this.oauth.getAuthorizationUrl(user.userId);
  }

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    await this.oauth.handleCallback({ code, state, error });
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    response.redirect(`${frontendUrl}/settings?linkedin=connected`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  status(@CurrentUser() user: { userId: string }) {
    return this.oauth.getConnectionStatus(user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect(@CurrentUser() user: { userId: string }) {
    return this.oauth.disconnect(user.userId);
  }
}
