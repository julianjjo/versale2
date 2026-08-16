import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Simulates the error Prisma throws when a foreign key with ON DELETE
// RESTRICT blocks a delete — e.g. deleting a user who still has products,
// orders, reviews or a cart pointing at them.
function foreignKeyRestrictError() {
  return new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    {
      code: 'P2003',
      clientVersion: 'test',
    },
  );
}

// Simulates the error Prisma throws when a write's `where` filter matches no
// row — e.g. a second concurrent delete of the same, already-deleted user.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

// Simulates the error Prisma throws when a unique constraint is violated —
// e.g. two concurrent requests racing to claim the same not-yet-taken email.
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`email`)',
    {
      code: 'P2002',
      clientVersion: 'test',
    },
  );
}

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockUserClient = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockPrismaService = {
    client: {
      user: mockUserClient,
      // remove() runs its admin-count check and delete inside a transaction;
      // invoking the callback with the same mocked `user` client (rather
      // than a separate tx double) keeps every existing
      // `mockPrismaService.client.user.*` expectation below valid unchanged.
      $transaction: jest.fn(
        (callback: (tx: { user: typeof mockUserClient }) => unknown) =>
          callback({ user: mockUserClient }),
      ),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      const hashedPassword = 'hashed_password_123';
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));

      const mockUser = {
        id: 'user1',
        email: createUserDto.email,
        name: createUserDto.name,
      };

      mockPrismaService.client.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockPrismaService.client.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          name: createUserDto.name,
          password: hashedPassword,
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return paginated users with no filters', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'USER',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.client.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.client.user.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(mockPrismaService.client.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockPrismaService.client.user.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({
        data: mockUsers,
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      });
    });

    it('should clamp a hostile page/limit instead of reaching Prisma', async () => {
      mockPrismaService.client.user.findMany.mockResolvedValue([]);
      mockPrismaService.client.user.count.mockResolvedValue(0);

      // `page=-1` used to compute `skip: -20`, which Prisma rejects outright,
      // and `limit` had no ceiling at all.
      const result = await service.findAll({ page: '-1', limit: '999999' });

      expect(mockPrismaService.client.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 100,
        pages: 0,
      });
    });

    it('should ignore a role that is not a real enum member', async () => {
      mockPrismaService.client.user.findMany.mockResolvedValue([]);
      mockPrismaService.client.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'BOGUS' });

      expect(mockPrismaService.client.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by search term across name and email', async () => {
      mockPrismaService.client.user.findMany.mockResolvedValue([]);
      mockPrismaService.client.user.count.mockResolvedValue(0);

      await service.findAll({ search: 'ana', page: '2', limit: '5' });

      expect(mockPrismaService.client.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ name: { contains: 'ana' } }, { email: { contains: 'ana' } }],
        },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should filter by role', async () => {
      mockPrismaService.client.user.findMany.mockResolvedValue([]);
      mockPrismaService.client.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'ADMIN' });

      expect(mockPrismaService.client.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'ADMIN' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const userId = 'user1';
      const mockUser = {
        id: userId,
        email: 'user1@example.com',
        name: 'User 1',
        role: 'USER',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = 'nonexistent';
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const storedUser = {
      email: 'user1@example.com',
      password: 'stored_hash',
    };

    const mockUpdatedUser = {
      id: 'user1',
      email: 'user1@example.com',
      name: 'User 1',
      role: 'USER',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a user without touching credentials', async () => {
      const userId = 'user1';
      const updateUserDto = { name: 'Updated Name' };

      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update(userId, updateUserDto, {
        isSelfService: true,
      });

      expect(mockPrismaService.client.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateUserDto,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should hash password if provided in update', async () => {
      const userId = 'user1';
      const updateUserDto = {
        password: 'newpassword123',
      };

      const hashedPassword = 'new_hashed_password';
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));

      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update(userId, updateUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: hashedPassword,
          // A password change must invalidate every JWT issued before it.
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('rejects a self-service password change without the current password with a 403, not a 401', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);

      // A 401 here would make the web app's global interceptor treat this as
      // an expired session and force-navigate to /login, wiping the form.
      await expect(
        service.update(
          'user1',
          { password: 'newpassword123' },
          { isSelfService: true },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('rejects a self-service password change when the current password is wrong with a 403, not a 401', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(
        service.update(
          'user1',
          { password: 'newpassword123', currentPassword: 'wrongpassword' },
          { isSelfService: true },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        storedUser.password,
      );
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('changes the password when the current password matches and never persists currentPassword', async () => {
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('new_hashed_password'));

      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      await service.update(
        'user1',
        { password: 'newpassword123', currentPassword: 'currentpassword' },
        { isSelfService: true },
      );

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          password: 'new_hashed_password',
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('rejects a self-service email change without the current password with a 403, not a 401', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);

      await expect(
        service.update(
          'user1',
          { email: 'attacker@example.com' },
          { isSelfService: true },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('keeps the exact Spanish message when the current password is wrong', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(
        service.update(
          'user1',
          { password: 'newpassword123', currentPassword: 'wrongpassword' },
          { isSelfService: true },
        ),
      ).rejects.toThrow(
        new ForbiddenException('La contraseña actual es incorrecta'),
      );
    });

    it('does not ask for the current password when the email is unchanged', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      await expect(
        service.update(
          'user1',
          { name: 'Updated Name', email: storedUser.email },
          { isSelfService: true },
        ),
      ).resolves.toEqual(mockUpdatedUser);
      expect(mockPrismaService.client.user.update).toHaveBeenCalled();
    });

    // Regression: a verification only ever proved ownership of the *old*
    // address. Without this, the profile page's "Correo verificado" badge
    // kept showing for an email that was never actually verified once the
    // user changed it.
    it('resets isVerified and clears the verification token when the email actually changes', async () => {
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
      mockPrismaService.client.user.findUnique
        // First call: the requester's own record, for the current-password check.
        .mockResolvedValueOnce(storedUser)
        // Second call: nobody else already has the new email.
        .mockResolvedValueOnce(null);
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      await service.update(
        'user1',
        { email: 'new@example.com', currentPassword: 'currentpassword' },
        { isSelfService: true },
      );

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            isVerified: false,
            verificationToken: null,
          }),
        }),
      );
    });

    it('lets an admin reset another account without its current password', async () => {
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('admin_reset_hash'));
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      await service.update('user1', { password: 'resetpassword123' });

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user1' },
          data: {
            password: 'admin_reset_hash',
            tokenVersion: { increment: 1 },
          },
        }),
      );
    });

    // Regression: a name-only update must not bump tokenVersion — only an
    // actual credential change should invalidate existing sessions.
    it('does not bump tokenVersion when no password is being changed', async () => {
      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      await service.update('user1', { name: 'Updated Name' });

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { name: 'Updated Name' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('throws a Spanish ConflictException when the new email is already taken', async () => {
      mockPrismaService.client.user.findUnique
        .mockResolvedValueOnce(storedUser)
        .mockResolvedValueOnce({ id: 'user2', email: 'taken@example.com' });

      await expect(
        service.update('user1', { email: 'taken@example.com' }),
      ).rejects.toThrow(
        new ConflictException('Ya existe una cuenta con ese correo'),
      );
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('throws a Spanish NotFoundException when the user no longer exists', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { email: 'new@example.com' }),
      ).rejects.toThrow(
        new NotFoundException('Usuario con ID nonexistent no encontrado'),
      );
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    // Regression: the email-uniqueness check above is a plain findUnique, not
    // a transaction — two concurrent requests changing different users to the
    // same not-yet-taken email can both pass it before either writes. The
    // losing write then hits the DB's unique constraint and must still read
    // as the same Spanish 409 instead of an unhandled 500.
    it('throws a Spanish ConflictException when a concurrent request claims the email first', async () => {
      mockPrismaService.client.user.findUnique
        .mockResolvedValueOnce(storedUser)
        .mockResolvedValueOnce(null);
      mockPrismaService.client.user.update.mockRejectedValue(
        uniqueConstraintError(),
      );

      await expect(
        service.update('user1', { email: 'taken@example.com' }),
      ).rejects.toThrow(
        new ConflictException('Ya existe una cuenta con ese correo'),
      );
    });

    // Regression: a non-credential update (just `name`, as in the first test
    // in this describe block) skips the findUnique guard above entirely —
    // that guard only exists to check the current password and the new
    // email's availability. Without it, updating an id deleted a moment
    // earlier reaches Prisma's update() directly, which raises P2025 for a
    // matched-no-row write; it must still read as the same Spanish 404
    // instead of an unhandled 500.
    it('throws a Spanish NotFoundException when updating a user deleted moments earlier', async () => {
      mockPrismaService.client.user.update.mockRejectedValue(notFoundError());

      await expect(
        service.update('user1', { name: 'Updated Name' }),
      ).rejects.toThrow(
        new NotFoundException('Usuario con ID user1 no encontrado'),
      );
    });

    it('re-throws an unrelated update error unchanged', async () => {
      const unrelatedError = new Error('boom');
      mockPrismaService.client.user.update.mockRejectedValue(unrelatedError);

      await expect(
        service.update('user1', { name: 'Updated Name' }),
      ).rejects.toThrow(unrelatedError);
    });
  });

  describe('remove', () => {
    it('should remove a regular user without leaking credential columns', async () => {
      const userId = 'user1';
      const requesterId = 'admin1';
      const mockDeletedUser = {
        id: userId,
        email: 'user1@example.com',
        name: 'User 1',
      };

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'USER',
      });
      mockPrismaService.client.user.delete.mockResolvedValue(mockDeletedUser);

      const result = await service.remove(userId, requesterId);

      expect(mockPrismaService.client.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockDeletedUser);
    });

    it('should throw NotFoundException if the target user does not exist', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.user.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when an admin tries to delete their own account', async () => {
      const adminId = 'admin1';

      await expect(service.remove(adminId, adminId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.client.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.client.user.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when deleting the last remaining admin', async () => {
      const targetId = 'admin2';
      const requesterId = 'admin1';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'ADMIN',
      });
      mockPrismaService.client.user.count.mockResolvedValue(1);

      await expect(service.remove(targetId, requesterId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.client.user.count).toHaveBeenCalledWith({
        where: { role: 'ADMIN' },
      });
      expect(mockPrismaService.client.user.delete).not.toHaveBeenCalled();
    });

    it('throws a Spanish BadRequestException when the user has related products, orders, reviews or a cart', async () => {
      const targetId = 'seller1';
      const requesterId = 'admin1';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'USER',
      });
      mockPrismaService.client.user.delete.mockRejectedValue(
        foreignKeyRestrictError(),
      );

      await expect(service.remove(targetId, requesterId)).rejects.toThrow(
        new BadRequestException(
          'No se puede eliminar a este usuario: tiene productos, pedidos, reseñas, favoritos, reportes o un carrito asociados.',
        ),
      );
    });

    // Regression: a second concurrent DELETE on the same target (a
    // double-click before the button disables, or two admin sessions) makes
    // this delete match no row. Prisma raises P2025 for that; it must still
    // read as the same 404 as a target that was never found, instead of an
    // unhandled 500.
    it('throws a Spanish NotFoundException when a concurrent request already deleted the target', async () => {
      const targetId = 'seller1';
      const requesterId = 'admin1';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'USER',
      });
      mockPrismaService.client.user.delete.mockRejectedValue(notFoundError());

      await expect(service.remove(targetId, requesterId)).rejects.toThrow(
        new NotFoundException(`Usuario con ID ${targetId} no encontrado`),
      );
    });

    it('re-throws an unrelated delete error unchanged', async () => {
      const targetId = 'seller1';
      const requesterId = 'admin1';
      const unrelatedError = new Error('boom');

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'USER',
      });
      mockPrismaService.client.user.delete.mockRejectedValue(unrelatedError);

      await expect(service.remove(targetId, requesterId)).rejects.toThrow(
        unrelatedError,
      );
    });

    it('should allow deleting an admin when other admins remain', async () => {
      const targetId = 'admin2';
      const requesterId = 'admin1';
      const mockDeletedUser = { id: targetId, role: 'ADMIN' };

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'ADMIN',
      });
      mockPrismaService.client.user.count.mockResolvedValue(2);
      mockPrismaService.client.user.delete.mockResolvedValue(mockDeletedUser);

      const result = await service.remove(targetId, requesterId);

      expect(mockPrismaService.client.user.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: targetId } }),
      );
      expect(result).toEqual(mockDeletedUser);
    });
  });
});
