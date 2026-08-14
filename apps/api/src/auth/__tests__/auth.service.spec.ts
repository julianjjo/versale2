import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
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
        update: jest.fn(),
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
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: '1',
        email,
        role: 'USER',
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
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should set a reset token and expiry, and return it outside production', async () => {
      process.env.NODE_ENV = 'test';
      const email = 'test@example.com';
      const user = { id: 'user1', email };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      mockPrismaService.client.user.update.mockResolvedValue(user);

      const result = await service.forgotPassword(email);

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          resetToken: expect.any(String),
          resetTokenExpires: expect.any(Date),
        },
      });
      expect(result.message).toBe(
        'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      );
      expect(result.resetToken).toEqual(expect.any(String));
    });

    it('should not include the reset token in the response in production', async () => {
      process.env.NODE_ENV = 'production';
      const email = 'test@example.com';
      const user = { id: 'user1', email };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      mockPrismaService.client.user.update.mockResolvedValue(user);

      const result = await service.forgotPassword(email);

      expect(result).toEqual({
        message:
          'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      });
    });

    // Must respond identically whether or not the email is registered —
    // otherwise the endpoint becomes an account-enumeration oracle.
    it('should return the same generic message when the email does not exist, without writing anything', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('missing@example.com');

      expect(result).toEqual({
        message:
          'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      });
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should hash the new password and clear the reset token', async () => {
      const token = 'valid-token';
      const newPassword = 'newPassword123';
      const hashedPassword = 'hashed_new_password';
      const user = {
        id: 'user1',
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 60_000),
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));
      mockPrismaService.client.user.update.mockResolvedValue({
        ...user,
        password: hashedPassword,
      });

      const result = await service.resetPassword(token, newPassword);

      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { resetToken: token },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
      expect(result).toEqual({
        message: 'Tu contraseña se actualizó correctamente',
      });
    });

    it('should reject an unknown token', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('should reject an expired token', async () => {
      const token = 'expired-token';
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'user1',
        resetToken: token,
        resetTokenExpires: new Date(Date.now() - 60_000),
      });

      await expect(
        service.resetPassword(token, 'newPassword123'),
      ).rejects.toThrow(
        'El enlace para restablecer la contraseña no es válido o expiró',
      );
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });
  });
});
