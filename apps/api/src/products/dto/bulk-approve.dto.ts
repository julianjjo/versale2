import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export class BulkApproveDto {
  @IsArray({ message: 'Los IDs deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos una publicación' })
  @ArrayMaxSize(100, {
    message: 'No puedes aprobar más de 100 publicaciones a la vez',
  })
  @IsString({ each: true, message: 'Cada ID debe ser un texto' })
  ids!: string[];
}
