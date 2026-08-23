import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteAccountDto } from '../delete-account.dto';

describe('DeleteAccountDto', () => {
  it('acepta el cuerpo válido con la contraseña actual', async () => {
    const dto = plainToInstance(DeleteAccountDto, {
      currentPassword: 'mi-clave-segura',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rechaza el cuerpo sin currentPassword', async () => {
    const dto = plainToInstance(DeleteAccountDto, {});

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'currentPassword')).toBe(
      true,
    );
  });

  it('rechaza una cadena vacía — la confirmación debe ser real', async () => {
    const dto = plainToInstance(DeleteAccountDto, { currentPassword: '' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'currentPassword')).toBe(
      true,
    );
  });

  it('rechaza un valor no string en currentPassword', async () => {
    const dto = plainToInstance(DeleteAccountDto, {
      currentPassword: 12345678,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'currentPassword')).toBe(
      true,
    );
  });
});
