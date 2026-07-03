import { IsOptional, IsString } from 'class-validator';

export class RejectPostDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
