/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

export class CreateQuestionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El producto seleccionado no es válido' })
  @IsNotEmpty({ message: 'Debes indicar el producto sobre el que preguntas' })
  productId!: string;

  @IsString({ message: 'La pregunta debe ser un texto' })
  @IsNotEmpty({ message: 'Escribe tu pregunta para el vendedor' })
  // IsNotEmpty only rejects '', null and undefined — a whitespace-only string
  // like '   ' passes it and would be stored as a question with nothing
  // readable in it.
  @Matches(/\S/, { message: 'Escribe tu pregunta para el vendedor' })
  @MaxLength(500, {
    message: 'La pregunta no puede superar los 500 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question!: string;
}
