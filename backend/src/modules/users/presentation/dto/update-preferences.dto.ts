import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  aiPreferences?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  timezone?: string;
}
