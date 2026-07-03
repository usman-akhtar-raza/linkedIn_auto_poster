import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnalyticsService } from '../application/analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  summary(@CurrentUser() user: { userId: string }) {
    return this.analytics.summary(user.userId);
  }
}
