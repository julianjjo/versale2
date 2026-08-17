import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class BulkRejectDto {
  @IsArray({ message: 'Los IDs deben enviarse como una lista' })
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos una publicación' })
  @ArrayMaxSize(100, {
    message: 'No puedes rechazar más de 100 publicaciones a la vez',
  })
  @IsString({ each: true, message: 'Cada ID debe ser un texto' })
  ids!: string[];

  @IsString({ message: 'El motivo del rechazo debe ser un texto' })
  @IsOptional()
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  reason?: string;
}
