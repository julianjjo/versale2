import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export class BulkUnpauseDto {
  @IsArray({ message: 'Los IDs deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos una publicación' })
  @ArrayMaxSize(100, {
    message: 'No puedes reactivar más de 100 publicaciones a la vez',
  })
  @IsString({ each: true, message: 'Cada ID debe ser un texto' })
  ids!: string[];
}
