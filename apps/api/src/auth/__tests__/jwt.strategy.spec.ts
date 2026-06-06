import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      user: {
        findUnique: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user object with id, email, and role if user is found', async () => {
      const payload = { sub: 'user1' };
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
      });
      expect(result).toEqual({
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
      });
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      const payload = { sub: 'nonexistent' };

      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
