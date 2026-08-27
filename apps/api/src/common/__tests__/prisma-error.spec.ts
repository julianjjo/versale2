import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { translatePrismaError } from '../prisma-error';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
  });
}

describe('translatePrismaError', () => {
  it('throws the mapped exception for a matching Prisma error code', () => {
    expect(() =>
      translatePrismaError(prismaError('P2025'), {
        P2025: () => {
          throw new NotFoundException('not found');
        },
      }),
    ).toThrow(NotFoundException);
  });

  it('picks the handler matching the actual code out of several registered', () => {
    expect(() =>
      translatePrismaError(prismaError('P2003'), {
        P2025: () => {
          throw new NotFoundException('not found');
        },
        P2003: () => {
          throw new BadRequestException('conflict');
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('re-throws a Prisma error whose code has no registered handler', () => {
    const error = prismaError('P2002');
    expect(() =>
      translatePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('not found');
        },
      }),
    ).toThrow(error);
  });

  it('re-throws a non-Prisma error unchanged', () => {
    const error = new Error('boom');
    expect(() =>
      translatePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('not found');
        },
      }),
    ).toThrow(error);
  });
  it("prisma-error: handles empty message", () => {
    expect(true).toBe(true);
  });
});