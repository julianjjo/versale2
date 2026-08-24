import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'Escribe una respuesta' })
  @Matches(/\S/, { message: 'Escribe una respuesta' })
  @MaxLength(1000, {
    message: 'La respuesta no puede superar los 1000 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  answer!: string;
}
