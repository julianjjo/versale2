import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
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

      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));
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
          verificationToken: expect.any(String),
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

    it('should not include the raw verification token in the response by default', async () => {
      delete process.env.AUTH_EXPOSE_VERIFICATION_TOKEN;
      const email = 'test@example.com';

      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));
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
        jest
          .spyOn(bcrypt, 'hash')
          .mockImplementation(() => Promise.resolve('hashed'));
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
        const writtenToken =
          mockPrismaService.client.user.create.mock.calls[0][0].data
            .verificationToken;
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
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
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
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password_123';

      const user = {
        id: '1',
        email,
        password: hashedPassword,
        name: 'Test User',
        role: 'USER',
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));

      const result = await service.validateUser(email, password);

      expect(result).toEqual({
        id: '1',
        email,
        name: 'Test User',
        role: 'USER',
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null if password invalid', async () => {
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
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
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
        where: { email },
        data: {
          // Stored hashed, never the raw token.
          resetToken: expect.any(String),
          resetTokenExpires: expect.any(Date),
        },
      });
      const writtenToken =
        mockPrismaService.client.user.updateMany.mock.calls[0][0].data
          .resetToken;
      expect(result.message).toBe(
        'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      );
      expect(result.resetToken).toEqual(expect.any(String));
      // The value returned to the caller must be the raw token, not the
      // hash that was actually persisted.
      expect(result.resetToken).not.toBe(writtenToken);
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
    });
  });

  describe('resetPassword', () => {
    it('should hash the new password and atomically consume a valid, unexpired token', async () => {
      const token = 'valid-token';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashed_new_password';

      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));
      mockPrismaService.client.user.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.resetPassword(token, newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockPrismaService.client.user.updateMany).toHaveBeenCalledWith({
        where: {
          resetToken: expect.any(String),
          resetTokenExpires: { gt: expect.any(Date) },
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
      const lookupHash =
        mockPrismaService.client.user.updateMany.mock.calls[0][0].where
          .resetToken;
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
        where: { verificationToken: expect.any(String) },
        data: { isVerified: true, verificationToken: null },
      });
      // Looked up by the actual SHA-256 digest of the token, never the raw
      // value — a weaker "just not equal to the raw token" check would still
      // pass for a broken/wrong hash implementation.
      const lookupHash =
        mockPrismaService.client.user.updateMany.mock.calls[0][0].where
          .verificationToken;
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
  });
});
