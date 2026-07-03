import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateScheduleDto {
  @IsIn([
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'WEEKDAYS',
    'WEEKENDS',
    'SPECIFIC_DATES',
    'CUSTOM_CRON',
  ])
  scheduleFrequency!:
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'WEEKDAYS'
    | 'WEEKENDS'
    | 'SPECIFIC_DATES'
    | 'CUSTOM_CRON';

  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  scheduleDates?: Date[];

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  scheduleTime?: string;
}
