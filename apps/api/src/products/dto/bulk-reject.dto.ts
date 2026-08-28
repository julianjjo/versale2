/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { BulkIdsDto } from './bulk-ids.dto';

export class BulkRejectDto extends BulkIdsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio' })
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason!: string;
}
