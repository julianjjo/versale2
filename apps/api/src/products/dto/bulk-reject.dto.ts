import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BulkIdsDto } from './bulk-ids.dto';

export class BulkRejectDto extends BulkIdsDto {
  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @IsOptional()
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason?: string;
}
