import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export const BULK_MAX_IDS = 100;

// Shared by every admin bulk action: the ids array rules are identical, only
// the subclass name (and, for reject, an extra field) differs.
export class BulkIdsDto {
  @IsArray({ message: 'Los IDs deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos una publicación' })
  @ArrayMaxSize(BULK_MAX_IDS, {
    message: `No puedes enviar más de ${BULK_MAX_IDS} publicaciones a la vez`,
  })
  @IsString({ each: true, message: 'Cada ID debe ser un texto' })
  ids!: string[];
}
