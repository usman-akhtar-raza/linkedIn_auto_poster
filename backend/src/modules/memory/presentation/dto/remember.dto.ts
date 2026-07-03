import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RememberDto {
  @IsString()
  type!: string;

  @IsString()
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  weight?: number;
}
