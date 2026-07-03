import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SchedulerService } from '../application/scheduler.service';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags('scheduler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Patch()
  update(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduler.updateSchedule(user.userId, dto);
  }
}
