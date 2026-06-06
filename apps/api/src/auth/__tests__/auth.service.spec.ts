import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
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

      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashedPassword));
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
        'User already exists',
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
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
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
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

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
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

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
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });
});
