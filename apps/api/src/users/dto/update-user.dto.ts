import { IsEmail, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @ValidateIf((_object, value) => value !== undefined)
  name?: string;

  @IsEmail()
  @ValidateIf((_object, value) => value !== undefined)
  email?: string;

  @IsString()
  @MinLength(6)
  @ValidateIf((_object, value) => value !== undefined)
  password?: string;
}
