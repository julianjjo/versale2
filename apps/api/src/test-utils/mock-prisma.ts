/**
 * Helpers for typing Jest mocks. Lets us avoid `any` in tests and satisfy
 * the strict ESLint `no-unsafe-*` rules without sprinkling `as any` casts.
 *
 * Usage:
 *   const mockPrismaClient = createMockPrismaClient({
 *     user: { findUnique: jest.fn(), create: jest.fn() },
 *   });
 *   mockPrismaClient.user.findUnique.mockResolvedValue({ id: '1' });
 */
type AnyMock = jest.Mock;

type MethodsObject = Record<string, AnyMock>;

export const createMockPrismaClient = <
  TModels extends Record<string, MethodsObject>,
>(
  models: TModels,
): TModels => models;
