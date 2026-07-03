import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from '../application/health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health() {
    return this.healthService.health();
  }

  @Get('readiness')
  readiness() {
    return this.healthService.readiness();
  }

  @Get('liveness')
  liveness() {
    return this.healthService.liveness();
  }
}
