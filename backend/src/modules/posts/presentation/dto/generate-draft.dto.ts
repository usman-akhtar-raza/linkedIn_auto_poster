import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateDraftDto {
  @IsString()
  topic!: string;

  @IsOptional()
  @IsBoolean()
  includeImage?: boolean;
}
