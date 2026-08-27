import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectProductDto {
  @IsOptional()
  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason?: string;
}
