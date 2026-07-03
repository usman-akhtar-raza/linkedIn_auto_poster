import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(20)
  systemPrompt!: string;

  @IsString()
  @MinLength(20)
  userPrompt!: string;
}
