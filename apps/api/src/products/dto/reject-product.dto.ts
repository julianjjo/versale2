import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectProductDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
