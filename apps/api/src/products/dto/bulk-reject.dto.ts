/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BulkIdsDto } from './bulk-ids.dto';

export class BulkRejectDto extends BulkIdsDto {
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
