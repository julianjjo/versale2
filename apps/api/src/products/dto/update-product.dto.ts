import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  @IsIn(['New', 'Like New', 'Good', 'Fair'])
  condition?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsOptional()
  images?: string[];
}
