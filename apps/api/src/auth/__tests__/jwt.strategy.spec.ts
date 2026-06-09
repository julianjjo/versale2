import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { createMockPrismaClient } from '../../test-utils/mock-prisma';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockPrismaClient = createMockPrismaClient({
    user: {
      findUnique: jest.fn(),
    },
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: { client: mockPrismaClient } },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user object with id, email, and role if user is found', async () => {
      const payload = {
        sub: 'user1',
        email: 'test@example.com',
        role: 'USER' as const,
      };
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
      });
      expect(result).toEqual({
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
      });
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      const payload = {
        sub: 'nonexistent',
        email: 'a@b.c',
        role: 'USER' as const,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
