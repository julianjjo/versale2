/* eslint-disable @typescript-eslint/no-unsafe-return -- Transform value is any from class-transformer */
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'La respuesta no puede estar vacía' })
  // IsNotEmpty only rejects '', null and undefined — a whitespace-only string
  // like '   ' passes it and would be stored as a reply with nothing readable
  // in it.
  @Matches(/\S/, { message: 'La respuesta no puede estar vacía' })
  @MaxLength(1000, {
    message: 'La respuesta no puede superar los 1000 caracteres',
  })
  reply!: string;
}
