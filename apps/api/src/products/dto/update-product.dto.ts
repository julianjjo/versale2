import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsPositive,
} from 'class-validator';

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

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @IsPositive()
  price?: number;

  @IsOptional()
  images?: string[];
}
