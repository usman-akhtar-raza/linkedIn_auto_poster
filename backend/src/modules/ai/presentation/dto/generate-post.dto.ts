import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GeneratePostDto {
  @IsString()
  topic!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audience?: string[];

  @IsOptional()
  @IsBoolean()
  includeImage?: boolean;
}
