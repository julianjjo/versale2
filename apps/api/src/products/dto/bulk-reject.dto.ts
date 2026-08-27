import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BulkIdsDto } from './bulk-ids.dto';

export class BulkRejectDto extends BulkIdsDto {
  @IsOptional()
  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason?: string;
}
