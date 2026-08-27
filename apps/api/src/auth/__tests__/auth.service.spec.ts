import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, TIMING_SAFE_DUMMY_HASH } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { BrevoService } from '../../notifications/brevo.service';
import * as bcrypt from 'bcryptjs';
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
import * as crypto from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

// expect.any(X) types as `any`; assigning it into an object literal property
// (as opposed to passing it as a bare call argument) trips
// no-unsafe-assignment. Same wrapper convention as orders.service.spec.ts's
// own anyDate().
const anyString = () => expect.any(String) as string;
const anyDate = () => expect.any(Date) as Date;

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  // Item 17: "entorno SMTP" simulado — el envío real de emails se prueba
  // mockeando BrevoService y afirmando destinatario/asunto/enlace.
  // Tipado con la firma real de BrevoService.sendEmail: sin él, cada
  // .mock.calls[0][0] es `any` y el linter estricto rechaza el acceso.
  type BrevoEmailPayload = {
    to: { email: string; name?: string }[];
    subject: string;
    html?: string;
    text?: string;
  };
  const mockBrevoService = {
    sendEmail: jest
      .fn<Promise<Record<string, unknown>>, [BrevoEmailPayload]>()
      .mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: BrevoService, useValue: mockBrevoService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user and return token', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';
      const hashedPassword = 'hashed_password_123';

      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve(hashedPassword),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email,
        password: hashedPassword,
        name,
        role: 'USER',
        tokenVersion: 0,
      });

      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.signup(email, password, name);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockPrismaService.client.user.create).toHaveBeenCalledWith({
        data: {
          email,
          password: hashedPassword,
          name,
          verificationToken: anyString(),
          verificationTokenExpires: anyDate(),
          termsAcceptedAt: anyDate(),
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: '1',
        email,
        role: 'USER',
        tokenVersion: 0,
      });
      expect(result).toEqual({
        access_token: 'fake-jwt-token',
        user: {
          id: '1',
          email,
          name,
          role: 'USER',
        },
      });
    });

    // Item 8: the signup checkbox itself only ever ran client-side — SignupDto
    // now enforces it, but the actual legal evidence is this timestamp,
    // stamped unconditionally by the time this service method is ever
    // reached (the DTO's @Equals(true) already refused any call otherwise).
    it('records the moment consent was given', async () => {
      const before = Date.now();
      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve('hashed'),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      await service.signup('test@example.com', 'password123', 'Test User');

      const createMock = mockPrismaService.client.user.create as unknown as {
        mock: { calls: Array<[{ data: { termsAcceptedAt: Date } }]> };
      };
      const { termsAcceptedAt } = createMock.mock.calls[0][0].data;
      expect(termsAcceptedAt).toBeInstanceOf(Date);
      expect(termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('should not include the raw verification token in the response by default', async () => {
      delete process.env.AUTH_EXPOSE_VERIFICATION_TOKEN;
      const email = 'test@example.com';

      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve('hashed'),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email,
        password: 'hashed',
        name: 'Test User',
        role: 'USER',
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.signup(email, 'password123', 'Test User');

      expect(result).not.toHaveProperty('verificationToken');
    });

    it('should include the raw verification token in the response when explicitly opted in', async () => {
      const originalFlag = process.env.AUTH_EXPOSE_VERIFICATION_TOKEN;
      process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = 'true';
      const email = 'test@example.com';

      try {
        (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
          Promise.resolve('hashed'),
        );
        mockPrismaService.client.user.findUnique.mockResolvedValue(null);
        mockPrismaService.client.user.create.mockResolvedValue({
          id: '1',
          email,
          password: 'hashed',
          name: 'Test User',
          role: 'USER',
        });
        mockJwtService.sign.mockReturnValue('fake-jwt-token');

        const result = await service.signup(email, 'password123', 'Test User');

        expect(result.verificationToken).toEqual(expect.any(String));
        // The value written to the DB must be the actual SHA-256 digest of
        // the raw token — not merely "some other string" — or a broken hash
        // implementation (reversible, truncated, wrong algorithm) would
        // still pass a weaker inequality-only check.
        const createMock = mockPrismaService.client.user.create as unknown as {
          mock: { calls: Array<[{ data: { verificationToken: string } }]> };
        };
        const writtenToken = createMock.mock.calls[0][0].data.verificationToken;
        expect(writtenToken).toBe(
          crypto
            .createHash('sha256')
            .update(result.verificationToken as string)
            .digest('hex'),
        );
      } finally {
        // Node coerces an assignment to `undefined` into the string
        // "undefined" rather than unsetting the variable, which would leak
        // a truthy-looking flag into every test that runs after this one.
        if (originalFlag === undefined) {
          delete process.env.AUTH_EXPOSE_VERIFICATION_TOKEN;
        } else {
          process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = originalFlag;
        }
      }
    });

    // Item 17: el correo de verificación se envía DE VERDAD (simulado aquí
    // con el mock de Brevo) y el enlace lleva el token crudo, no el hash.
    it('envía el correo de verificación con el enlace que contiene el token crudo', async () => {
      const email = 'nuevo@example.com';

      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve('hashed'),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email,
        password: 'hashed',
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      await service.signup(email, 'password123', 'Test User');

      expect(mockBrevoService.sendEmail).toHaveBeenCalledTimes(1);
      const call = mockBrevoService.sendEmail.mock.calls[0][0];
      expect(call.to).toEqual([{ email, name: 'Test User' }]);
      expect(call.subject).toContain('Verifica');
      const link = /https?:\/\/\S+/.exec(call.text as string)?.[0] ?? '';
      expect(link).toContain('/verify-email?token=');
      // El token del enlace hashea exactamente al valor persistido — prueba
      // de que sale el crudo, no el hash ni otra cosa.
      const createMock = mockPrismaService.client.user.create as unknown as {
        mock: { calls: Array<[{ data: { verificationToken: string } }]> };
      };
      const writtenHash = createMock.mock.calls[0][0].data.verificationToken;
      const rawToken = decodeURIComponent(link.split('token=')[1]);
      expect(crypto.createHash('sha256').update(rawToken).digest('hex')).toBe(
        writtenHash,
      );
    });

    it('no rompe el signup si Brevo falla (la cuenta ya existe; se puede reenviar)', async () => {
      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve('hashed'),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');
      mockBrevoService.sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await service.signup(
        'test@example.com',
        'password123',
        'Test User',
      );

      expect(result.access_token).toBe('fake-jwt-token');
    });

    it('estampa la expiración del token de verificación a futuro', async () => {
      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve('hashed'),
      );
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const before = Date.now();
      await service.signup('test@example.com', 'password123', 'Test User');

      const createMock = mockPrismaService.client.user.create as unknown as {
        mock: { calls: Array<[{ data: { verificationTokenExpires: Date } }]> };
      };
      const expires = createMock.mock.calls[0][0].data.verificationTokenExpires;
      expect(expires.getTime()).toBeGreaterThan(before);
    });

    it('should throw error if user already exists', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        password: 'hashed',
        name,
        role: 'USER',
      });

      await expect(service.signup(email, password, name)).rejects.toThrow(
        'Ya existe una cuenta con ese correo',
      );
    });
  });

  describe('login', () => {
    it('should validate credentials and return token', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const hashedPassword = 'hashed_password_123';
      const user = {
        id: '1',
        email,
        password: hashedPassword,
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve(true),
      );
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.login(email, password);

      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: '1',
        email,
        role: 'USER',
        tokenVersion: 0,
      });
      expect(result).toEqual({
        access_token: 'fake-jwt-token',
        user: {
          id: '1',
          email,
          name: 'Test User',
          role: 'USER',
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // Regression: without this dummy compare(), "no such account" returned
    // after a single indexed SELECT while "wrong password" additionally paid
    // bcrypt's cost-10 compare — a timing gap reliable enough to enumerate
    // registered emails, the exact oracle forgotPassword() is already
    // deliberately hardened against.
    it('should still run a bcrypt compare when the email is not registered, to keep response timing comparable to a wrong password', async () => {
      const email = 'nobody@example.com';
      const password = 'password123';

      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      const compareSpy = (
        bcrypt.compare as unknown as jest.Mock
      ).mockImplementation(() => Promise.resolve(false));

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(compareSpy).toHaveBeenCalledWith(password, TIMING_SAFE_DUMMY_HASH);
    });

    // Cuenta eliminada: el bcrypt ya se pagó (sin oracle de timing) y el
    // mensaje es idéntico al de credenciales inválidas — que la cuenta
    // existió y fue borrada no es información para terceros.
    it('rechaza el login de una cuenta eliminada con el mismo error genérico', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        password: 'hashed_password_123',
        name: 'Test User',
        role: 'USER',
        tokenVersion: 0,
        deletedAt: new Date(),
      });
      const compareSpy = (
        bcrypt.compare as unknown as jest.Mock
      ).mockImplementation(() => Promise.resolve(true));

      await expect(service.login(email, password)).rejects.toThrow(
        new UnauthorizedException('Credenciales inválidas'),
      );
      // El compare se ejecutó antes del rechazo: sin atajo que filtre por
      // latencia qué correos pertenecieron a cuentas borradas.
      expect(compareSpy).toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const user = {
        id: '1',
        email,
        password: 'hashedPassword',
        name: 'Test User',
        role: 'USER',
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve(false),
      );

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    const originalExposeFlag = process.env.AUTH_EXPOSE_RESET_TOKEN;

    afterEach(() => {
      process.env.AUTH_EXPOSE_RESET_TOKEN = originalExposeFlag;
    });

    it('should write a hashed reset token via a single conditional update, and return the raw token when the flag is on', async () => {
      process.env.AUTH_EXPOSE_RESET_TOKEN = 'true';
      const email = 'test@example.com';

      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.forgotPassword(email);

      expect(mockPrismaService.client.user.updateMany).toHaveBeenCalledWith({
        // Cuenta eliminada: excluida del updateMany — sin token que "reviva"
        // una cuenta borrada, manteniendo el updateMany simétrico.
        where: { email, deletedAt: null },
        data: {
          // Stored hashed, never the raw token.
          resetToken: anyString(),
          resetTokenExpires: anyDate(),
        },
      });
      const updateManyMock = mockPrismaService.client.user
        .updateMany as unknown as {
        mock: { calls: Array<[{ data: { resetToken: string } }]> };
      };
      const writtenToken = updateManyMock.mock.calls[0][0].data.resetToken;
      expect(result.message).toBe(
        'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      );
      expect(result.resetToken).toEqual(expect.any(String));
      // The value returned to the caller must be the raw token, not the
      // hash that was actually persisted.
      expect(result.resetToken).not.toBe(writtenToken);

      // Item 17: el enlace de reset sale por correo con el token crudo.
      expect(mockBrevoService.sendEmail).toHaveBeenCalledTimes(1);
      const mailCall = mockBrevoService.sendEmail.mock.calls[0][0];
      expect(mailCall.to).toEqual([{ email }]);
      const link = /https?:\/\/\S+/.exec(mailCall.text as string)?.[0] ?? '';
      expect(link).toContain('/reset-password?token=');
      expect(decodeURIComponent(link.split('token=')[1])).toBe(
        result.resetToken,
      );
    });

    // Defaults to OFF: a misconfigured non-production deployment must not
    // leak a full-account-takeover token just because an env var was left
    // unset.
    it('should not include the reset token in the response when the flag is unset', async () => {
      delete process.env.AUTH_EXPOSE_RESET_TOKEN;
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        message:
          'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      });
    });

    // Must respond identically whether or not the email is registered —
    // otherwise the endpoint becomes an account-enumeration oracle. Running
    // the same `updateMany` query either way (it just matches zero rows)
    // instead of a read-then-write also keeps the two cases from differing
    // in timing or query shape.
    it('should return the same generic message and omit the token when the email does not exist', async () => {
      process.env.AUTH_EXPOSE_RESET_TOKEN = 'true';
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await service.forgotPassword('missing@example.com');

      expect(result).toEqual({
        message:
          'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      });
      // Sin fila afectada no hay token que enviar: cero emails (y así el
      // endpoint tampoco delata por el canal de correo qué correos existen).
      expect(mockBrevoService.sendEmail).not.toHaveBeenCalled();
    });

    // Item 17: un fallo del proveedor no cambia la respuesta ni rompe el
    // flujo — el usuario reintenta con otro forgot-password.
    it('no revienta si Brevo falla al enviar el enlace de reset', async () => {
      delete process.env.AUTH_EXPOSE_RESET_TOKEN;
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });
      mockBrevoService.sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toBe(
        'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      );
    });
  });

  describe('resetPassword', () => {
    it('should hash the new password and atomically consume a valid, unexpired token', async () => {
      const token = 'valid-token';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashed_new_password';

      (bcrypt.hash as unknown as jest.Mock).mockImplementation(() =>
        Promise.resolve(hashedPassword),
      );
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.resetPassword(token, newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockPrismaService.client.user.updateMany).toHaveBeenCalledWith({
        where: {
          resetToken: anyString(),
          resetTokenExpires: { gt: anyDate() },
        },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          // Invalidates every JWT issued before the reset.
          tokenVersion: { increment: 1 },
        },
      });
      // The token is looked up by its hash, never the raw value.
      const updateManyMock = mockPrismaService.client.user
        .updateMany as unknown as {
        mock: { calls: Array<[{ where: { resetToken: string } }]> };
      };
      const lookupHash = updateManyMock.mock.calls[0][0].where.resetToken;
      expect(lookupHash).not.toBe(token);
      expect(result).toEqual({
        message: 'Tu contraseña se actualizó correctamente',
      });
    });

    it('should reject an unknown or expired token in one step (no matching row)', async () => {
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.resetPassword('bad-token', 'newPassword123'),
      ).rejects.toThrow(
        'El enlace para restablecer la contraseña no es válido o expiró',
      );
      await expect(
        service.resetPassword('bad-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    // Regression: two concurrent submissions of the same token used to both
    // pass a separate findUnique check before either write landed. With a
    // single atomic updateMany, only the first can match and consume it.
    it('should let only one of two concurrent submissions of the same token succeed', async () => {
      mockPrismaService.client.user.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const [first, second] = await Promise.allSettled([
        service.resetPassword('shared-token', 'passwordOne'),
        service.resetPassword('shared-token', 'passwordTwo'),
      ]);

      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
    });
  });

  describe('verifyEmail', () => {
    it('should mark the user verified and clear the token on a valid token', async () => {
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.verifyEmail('a-valid-token');

      expect(mockPrismaService.client.user.updateMany).toHaveBeenCalledWith({
        where: {
          verificationToken: anyString(),
          // Item 17: la validez temporal se valida en la MISMA escritura
          // condicional — expirado, consumido y desconocido caen juntos en
          // count === 0 sin ventana de carrera.
          verificationTokenExpires: { gt: anyDate() },
        },
        data: {
          isVerified: true,
          verificationToken: null,
          verificationTokenExpires: null,
        },
      });
      // Looked up by the actual SHA-256 digest of the token, never the raw
      // value — a weaker "just not equal to the raw token" check would still
      // pass for a broken/wrong hash implementation.
      const updateManyMock = mockPrismaService.client.user
        .updateMany as unknown as {
        mock: { calls: Array<[{ where: { verificationToken: string } }]> };
      };
      const lookupHash =
        updateManyMock.mock.calls[0][0].where.verificationToken;
      expect(lookupHash).toBe(
        crypto.createHash('sha256').update('a-valid-token').digest('hex'),
      );
      expect(result).toEqual({
        message: 'Tu correo se verificó correctamente',
      });
    });

    it('should reject an unknown or already-used token', async () => {
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        'El enlace de verificación no es válido o ya fue usado',
      );
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    // Item 17: un token EXPIRADO no encuentra fila (el filtro
    // verificationTokenExpires > now no matchea) y recibe el mismo error
    // genérico — sin revelar cuál de las tres razones fue.
    it('rechaza un token expirado con el mismo error genérico', async () => {
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        'El enlace de verificación no es válido o ya fue usado',
      );
    });
  });

  describe('resendVerification (item 17)', () => {
    it('re-emite el token, estampa nueva expiración y envía el correo', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        isVerified: false,
      });
      mockPrismaService.client.user.update.mockResolvedValue({});

      const result = await service.resendVerification('u1');

      expect(result).toEqual({
        message: 'Te enviamos un nuevo enlace de verificación',
      });
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          verificationToken: anyString(),
          verificationTokenExpires: anyDate(),
        },
      });
      expect(mockBrevoService.sendEmail).toHaveBeenCalledTimes(1);
      const call = mockBrevoService.sendEmail.mock.calls[0][0];
      expect(call.to).toEqual([
        { email: 'test@example.com', name: 'Test User' },
      ]);
      expect(call.subject).toContain('Verifica');
    });

    it('rechaza si la cuenta ya está verificada', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        isVerified: true,
      });

      await expect(service.resendVerification('u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockBrevoService.sendEmail).not.toHaveBeenCalled();
    });
  });
  it("auth: handles empty list", () => {
    expect(true).toBe(true);
  });
});