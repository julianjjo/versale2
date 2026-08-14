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
      const payload = { sub: 'user1', tokenVersion: 0 };
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
        tokenVersion: 0,
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
      const payload = { sub: 'nonexistent', tokenVersion: 0 };

      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // Regression: resetPassword/change-password bump the stored tokenVersion
    // precisely so a token signed before the change stops working. Without
    // this check, a stolen token kept working even after the legitimate
    // owner "secured" the account.
    it('should throw UnauthorizedException when the token predates a password reset', async () => {
      const payload = { sub: 'user1', tokenVersion: 0 };
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
        tokenVersion: 1,
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(mockUser);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // Tokens signed before tokenVersion existed carry no such claim at all —
    // they must keep working until the first reset, not be rejected outright.
    it('should accept a token with no tokenVersion claim when the user has never reset', async () => {
      const payload = { sub: 'user1' };
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
        tokenVersion: 0,
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user1',
        email: 'test@example.com',
        role: 'USER',
      });
    });
  });
});
