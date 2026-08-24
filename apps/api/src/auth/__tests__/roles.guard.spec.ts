import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { Role } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any): ExecutionContext => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
    return mockContext;
  };

  it('should return true if no roles are required', () => {
    const context = createMockExecutionContext({ role: 'USER' });
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should return true if user has required role', () => {
    const context = createMockExecutionContext({ role: Role.ADMIN });
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should return false if user does not have required role', () => {
    const context = createMockExecutionContext({ role: Role.USER });
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should return false if user is not present', () => {
    const context = createMockExecutionContext(null);
    mockReflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });
});
