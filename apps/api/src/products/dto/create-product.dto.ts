import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsNotEmpty()
  size!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['New', 'Like New', 'Good', 'Fair'])
  condition!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  images?: any;
}
