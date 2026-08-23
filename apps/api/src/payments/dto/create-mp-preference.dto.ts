import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMpPreferenceDto {
  @IsString({ message: 'orderId debe ser un texto' })
  @IsNotEmpty({ message: 'orderId es obligatorio' })
  orderId!: string;

  @IsOptional()
  backUrls?: {
    success?: string;
    failure?: string;
  };
}
