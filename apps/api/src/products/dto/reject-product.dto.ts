/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectProductDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason?: string;
}
