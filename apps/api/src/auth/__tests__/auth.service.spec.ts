import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { createMockPrismaClient } from '../../test-utils/mock-prisma';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaClient = createMockPrismaClient({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  });

  const mockJwtService: { sign: jest.Mock<string, [unknown]> } = {
    sign: jest.fn<string, [unknown]>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: { client: mockPrismaClient },
        },
        { provide: JwtService, useValue: mockJwtService },
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

      jest
        .spyOn(bcrypt, 'hash')
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        .mockImplementation(() => Promise.resolve(hashedPassword));
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: '1',
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      });

      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.signup(email, password, name);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
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

      mockPrismaClient.user.findUnique.mockResolvedValue({
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

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'compare')
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        .mockImplementation(() => Promise.resolve(true));
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.login(email, password);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
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

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

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

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'compare')
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
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

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'compare')
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

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

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest
        .spyOn(bcrypt, 'compare')
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        .mockImplementation(() => Promise.resolve(false));

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });
});
