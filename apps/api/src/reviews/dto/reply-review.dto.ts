import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'La respuesta no puede estar vacía' })
  @MaxLength(1000, {
    message: 'La respuesta no puede superar los 1000 caracteres',
  })
  reply!: string;
}
