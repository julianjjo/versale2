import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthRequest } from '../../types/request.types';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  resolveBearerUser,
} from '../jwt-auth.guard';

const mockJwtService = { verifyAsync: jest.fn() };
const mockPrismaService = {
  client: {
    user: {
      findUnique: jest.fn(),
    },
  },
};
const asServices = () =>
  [mockJwtService, mockPrismaService] as unknown as [JwtService, PrismaService];

describe('JwtAuthGuard (resolveBearerUser)', () => {
  let jwtService: JwtService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const requestWith = (authorization?: string) => ({
    headers: authorization ? { authorization } : {},
  });

  it('resolves the user for a valid bearer token', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user1',
      tokenVersion: 0,
    });
    mockPrismaService.client.user.findUnique.mockResolvedValue({
      id: 'user1',
      email: 'test@example.com',
      role: 'USER',
      tokenVersion: 0,
    });

    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith('Bearer valid-token'),
    );

    expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user1' },
    });
    expect(result).toEqual({
      id: 'user1',
      email: 'test@example.com',
      role: 'USER',
    });
  });

  it('returns null when there is no bearer header', async () => {
    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith(),
    );
    expect(result).toBeNull();
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('returns null when the token does not verify', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith('Bearer broken-token'),
    );

    expect(result).toBeNull();
    expect(mockPrismaService.client.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when the user no longer exists', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'ghost',
      tokenVersion: 0,
    });
    mockPrismaService.client.user.findUnique.mockResolvedValue(null);

    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith('Bearer valid-token'),
    );

    expect(result).toBeNull();
  });

  // Regression: resetPassword bumps tokenVersion precisely so a token signed
  // before the change stops working. Without this check, a stolen token kept
  // working even after the legitimate owner "secured" the account.
  it('rejects a token that predates a password reset', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user1',
      tokenVersion: 0,
    });
    mockPrismaService.client.user.findUnique.mockResolvedValue({
      id: 'user1',
      email: 'test@example.com',
      role: 'USER',
      tokenVersion: 1,
    });

    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith('Bearer old-token'),
    );

    expect(result).toBeNull();
  });

  // Tokens signed before tokenVersion existed carry no such claim at all —
  // they must keep working until the first reset, not be rejected outright.
  it('accepts a token with no tokenVersion claim when the user never reset', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user1' });
    mockPrismaService.client.user.findUnique.mockResolvedValue({
      id: 'user1',
      email: 'test@example.com',
      role: 'USER',
      tokenVersion: 0,
    });

    const result = await resolveBearerUser(
      jwtService,
      prismaService,
      requestWith('Bearer legacy-token'),
    );

    expect(result).toEqual({
      id: 'user1',
      email: 'test@example.com',
      role: 'USER',
    });
  });

  describe('guard behavior', () => {
    const makeContext = () => {
      const request = { headers: {} } as unknown as AuthRequest;
      return {
        switchToHttp: () => ({ getRequest: () => request }),
        request,
      };
    };

    it('attaches the user and accepts a valid request', async () => {
      const guard = new JwtAuthGuard(...asServices());
      const ctx = makeContext();
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user1',
        tokenVersion: 0,
      });
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        role: 'ADMIN',
        tokenVersion: 0,
      });
      Object.assign(ctx.request, { headers: { authorization: 'Bearer ok' } });

      await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
      expect(ctx.request.user).toEqual({
        id: 'user1',
        email: 'test@example.com',
        role: 'ADMIN',
      });
    });

    it('throws Unauthorized when authentication fails', async () => {
      const guard = new JwtAuthGuard(...asServices());
      const ctx = makeContext();

      await expect(guard.canActivate(ctx as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('optional guard swallows failures and leaves user unset', async () => {
      const guard = new OptionalJwtAuthGuard(...asServices());
      const ctx = makeContext();

      await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
      expect(ctx.request.user).toBeUndefined();
    });
  });
});
