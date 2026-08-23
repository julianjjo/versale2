import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// bcryptjs's hash()/compare() are each overloaded (a Promise-returning
// signature and a Node-callback, void-returning one); jest.spyOn on the
// bare overloaded function infers a mock whose value type collapses to
// `never`. Spying through a narrowed, single-signature view of the module
// picks the Promise overload unambiguously.
type BcryptHash = (password: string, salt: number | string) => Promise<string>;
type BcryptCompare = (password: string, hash: string) => Promise<boolean>;

function spyOnBcryptHash() {
  return jest.spyOn(bcrypt as unknown as { hash: BcryptHash }, 'hash');
}
function spyOnBcryptCompare() {
  return jest.spyOn(bcrypt as unknown as { compare: BcryptCompare }, 'compare');
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

  const mockUserClient = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  // Models touched by anonymizeUserInTransaction — every one of its writes
  // must be observable from the specs below, both to assert the happy path
  // and to prove nothing runs when a guard rejects.
  const mockProductClient = { updateMany: jest.fn() };
  const mockCartItemClient = { deleteMany: jest.fn() };
  const mockCartClient = { deleteMany: jest.fn() };
  const mockFavoriteClient = { deleteMany: jest.fn() };
  const mockReviewHelpfulVoteClient = { deleteMany: jest.fn() };
  const mockNotificationClient = { deleteMany: jest.fn() };
  const mockOrderClient = { updateMany: jest.fn() };

  const txClient = {
    user: mockUserClient,
    product: mockProductClient,
    cartItem: mockCartItemClient,
    cart: mockCartClient,
    favorite: mockFavoriteClient,
    reviewHelpfulVote: mockReviewHelpfulVoteClient,
    notification: mockNotificationClient,
    order: mockOrderClient,
  };

  const mockPrismaService = {
    client: {
      ...txClient,
      // remove()/deleteOwnAccount()/the cron run their writes inside a
      // transaction; invoking the callback with the same mocked clients
      // (rather than a separate tx double) keeps every existing
      // `mockPrismaService.client.*` expectation below valid unchanged.
      $transaction: jest.fn(
        (
          callback: (tx: {
            user: typeof mockUserClient;
            product: typeof mockProductClient;
            cartItem: typeof mockCartItemClient;
            cart: typeof mockCartClient;
            favorite: typeof mockFavoriteClient;
            reviewHelpfulVote: typeof mockReviewHelpfulVoteClient;
            notification: typeof mockNotificationClient;
            order: typeof mockOrderClient;
          }) => unknown,
        ) => callback(txClient),
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
      spyOnBcryptHash().mockResolvedValue(hashedPassword);

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
      spyOnBcryptHash().mockResolvedValue(hashedPassword);

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
      spyOnBcryptCompare().mockResolvedValue(false);

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
      spyOnBcryptCompare().mockResolvedValue(true);
      spyOnBcryptHash().mockResolvedValue('new_hashed_password');

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
      spyOnBcryptCompare().mockResolvedValue(false);

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
      spyOnBcryptCompare().mockResolvedValue(true);
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
          }) as Record<string, unknown>,
        }),
      );
    });

    it('lets an admin reset another account without its current password', async () => {
      spyOnBcryptHash().mockResolvedValue('admin_reset_hash');
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

  describe('remove (admin, ahora anonimiza)', () => {
    it('anonimiza al usuario en vez de borrarlo físicamente', async () => {
      const targetId = 'seller1';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'USER',
      });
      mockPrismaService.client.user.update.mockResolvedValue({ id: targetId });

      await service.remove(targetId, 'admin1');

      expect(mockPrismaService.client.user.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.client.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: { sellerId: targetId, status: 'AVAILABLE' },
        data: { status: 'WITHDRAWN' },
      });
      // La identidad queda sustituida, con deletedAt sellado.
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetId },
          data: expect.objectContaining({
            name: 'Usuario eliminado',
            email: `eliminado-${targetId}@anonymized.invalid`,
            isVerified: false,
            verificationToken: null,
            resetToken: null,
            tokenVersion: { increment: 1 },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should throw NotFoundException if the target user does not exist', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when an admin tries to delete their own account', async () => {
      const adminId = 'admin1';

      await expect(service.remove(adminId, adminId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.client.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.client.$transaction).not.toHaveBeenCalled();
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
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('should allow deleting an admin when other admins remain', async () => {
      const targetId = 'admin2';
      const requesterId = 'admin1';

      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: targetId,
        role: 'ADMIN',
      });
      mockPrismaService.client.user.count.mockResolvedValue(2);
      mockPrismaService.client.user.update.mockResolvedValue({ id: targetId });

      const result = await service.remove(targetId, requesterId);

      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: targetId } }),
      );
      expect(result).toEqual({
        message: `Cuenta de ${targetId} anonimizada correctamente`,
      });
    });
  });

  describe('deleteOwnAccount', () => {
    const userId = 'user1';
    const storedUser = {
      id: userId,
      password: 'stored_hash',
      role: 'USER',
    };

    function expectAnonymizationWrites() {
      // Prendas activas fuera del catálogo…
      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: { sellerId: userId, status: 'AVAILABLE' },
        data: { status: 'WITHDRAWN' },
      });
      // …datos personales sin valor comunitario borrados…
      expect(mockPrismaService.client.cartItem.deleteMany).toHaveBeenCalledWith(
        {
          where: { cart: { userId } },
        },
      );
      expect(mockPrismaService.client.cart.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaService.client.favorite.deleteMany).toHaveBeenCalledWith(
        {
          where: { userId },
        },
      );
      expect(
        mockPrismaService.client.reviewHelpfulVote.deleteMany,
      ).toHaveBeenCalledWith({ where: { userId } });
      expect(
        mockPrismaService.client.notification.deleteMany,
      ).toHaveBeenCalledWith({ where: { userId } });
      // …direcciones ya prescribidas redactadas al instante.
      expect(mockPrismaService.client.order.updateMany).toHaveBeenCalledTimes(
        1,
      );
      const orderUpdate = mockPrismaService.client.order
        .updateMany as unknown as {
        mock: {
          calls: Array<
            [
              {
                where: Record<string, unknown>;
                data: { shippingAddressRedactedAt: unknown };
              },
            ]
          >;
        };
      };
      const orderWrite = orderUpdate.mock.calls[0][0];
      expect(orderWrite.where).toMatchObject({ userId });
      expect(orderWrite.where.shippingAddressRedactedAt).toBeNull();
      // …y la PII de la fila sobrescrita con la sesión invalidada.
      expect(mockPrismaService.client.user.update).toHaveBeenCalledTimes(1);
      const userUpdate = mockPrismaService.client.user.update as unknown as {
        mock: {
          calls: Array<
            [{ where: { id: string }; data: Record<string, unknown> }]
          >;
        };
      };
      const write = userUpdate.mock.calls[0][0];
      expect(write.where.id).toBe(userId);
      expect(write.data).toMatchObject({
        name: 'Usuario eliminado',
        email: `eliminado-${userId}@anonymized.invalid`,
        isVerified: false,
        verificationToken: null,
        verificationTokenExpires: null,
        resetToken: null,
        resetTokenExpires: null,
        tokenVersion: { increment: 1 },
      });
      expect(write.data.deletedAt).toBeInstanceOf(Date);
      expect(typeof write.data.password).toBe('string');
    }

    it('anonimiza la cuenta cuando la contraseña actual es correcta', async () => {
      spyOnBcryptCompare().mockResolvedValue(true);
      spyOnBcryptHash().mockResolvedValue('random_replacement_hash');
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);

      const result = await service.deleteOwnAccount(userId, {
        currentPassword: 'correcta',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correcta',
        storedUser.password,
      );
      expectAnonymizationWrites();
      expect(result).toEqual({
        message: 'Tu cuenta se eliminó correctamente',
      });
    });

    it('rechaza con 403 cuando la contraseña actual es incorrecta y no escribe nada', async () => {
      spyOnBcryptCompare().mockResolvedValue(false);
      mockPrismaService.client.user.findUnique.mockResolvedValue(storedUser);

      await expect(
        service.deleteOwnAccount(userId, { currentPassword: 'mala' }),
      ).rejects.toThrow(
        new ForbiddenException('La contraseña actual es incorrecta'),
      );
      expect(mockPrismaService.client.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza con 403 al último administrador sin tocar sus datos', async () => {
      spyOnBcryptCompare().mockResolvedValue(true);
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        ...storedUser,
        role: 'ADMIN',
      });
      mockPrismaService.client.user.count.mockResolvedValue(1);

      await expect(
        service.deleteOwnAccount(userId, { currentPassword: 'correcta' }),
      ).rejects.toThrow(
        new ForbiddenException('No puedes eliminar al último administrador.'),
      );
      // El guardia corre dentro de la transacción: nada más se escribió.
      expect(
        mockPrismaService.client.product.updateMany,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.client.user.update).not.toHaveBeenCalled();
    });

    it('lanza 404 si el usuario no existe', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteOwnAccount(userId, { currentPassword: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('redactAddressesForDeletedAccounts (cron horario)', () => {
    it('redacta solo direcciones prescribidas de cuentas borradas', async () => {
      mockPrismaService.client.order.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.redactAddressesForDeletedAccounts();

      expect(result).toBe(3);
      expect(mockPrismaService.client.order.updateMany).toHaveBeenCalledTimes(
        1,
      );
      const orderUpdate = mockPrismaService.client.order
        .updateMany as unknown as {
        mock: { calls: Array<[Record<string, unknown>]> };
      };
      expect(orderUpdate.mock.calls[0][0].where).toMatchObject({
        shippingAddressRedactedAt: null,
        user: { deletedAt: { not: null } },
      });
    });

    it('no registra nada cuando no hay direcciones por redactar', async () => {
      mockPrismaService.client.order.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.redactAddressesForDeletedAccounts()).resolves.toBe(
        0,
      );
    });
  });
});
