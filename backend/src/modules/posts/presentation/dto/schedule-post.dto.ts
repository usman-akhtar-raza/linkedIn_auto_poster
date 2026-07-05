import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';

export class SchedulePostDto {
  @Type(() => Date)
  @IsDate()
  scheduledFor!: Date;
}
