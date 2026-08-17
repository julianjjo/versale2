import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class AnswerQuestionDto {
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'Escribe una respuesta' })
  @Matches(/\S/, { message: 'Escribe una respuesta' })
  @MaxLength(1000, {
    message: 'La respuesta no puede superar los 1000 caracteres',
  })
  @Trim()
  answer!: string;
}
