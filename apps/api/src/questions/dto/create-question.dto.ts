import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateQuestionDto {
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
  @Trim()
  question!: string;
}
