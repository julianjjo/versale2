import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { AuthRequest } from '../../../src/types/request.types';
import { ROLES_KEY } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deleteOwnAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call usersService.findAll with query', async () => {
      const query = { search: 'ana', role: 'ADMIN', page: '1', limit: '10' };
      const mockResult = {
        data: [{ id: 'user1', email: 'user1@example.com', name: 'User 1' }],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      };

      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with id', async () => {
      const userId = 'user1';
      const mockResult = {
        id: userId,
        email: 'user1@example.com',
        name: 'User 1',
      };

      mockUsersService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne(userId);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });

    it("is restricted to admins only, so a regular user cannot harvest another user's email", () => {
      // GET /users/:id returns PUBLIC_USER_SELECT (which includes email) for an
      // arbitrary user id. The frontend never calls this per-id endpoint, so the
      // fix is to lock it down to ADMIN via RolesGuard/@Roles, same as GET /users.
      const reflector = new Reflector();
      const requiredRoles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        // The method reference is only used as a decorator-metadata lookup
        // key here, never invoked, so there's no unbound-`this` risk.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        UsersController.prototype.findOne,
        UsersController,
      ]);

      expect(requiredRoles).toEqual([Role.ADMIN]);
    });
  });

  describe('update', () => {
    it('should call usersService.update with id and updateUserDto', async () => {
      const userId = 'user1';
      const updateUserDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const mockResult = {
        id: userId,
        ...updateUserDto,
      };

      mockUsersService.update.mockResolvedValue(mockResult);

      const result = await controller.update(userId, updateUserDto);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('should call usersService.remove with id and the requesting admin id', async () => {
      const userId = 'user1';
      const requesterId = 'admin1';
      const mockReq = {
        user: { id: requesterId, email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;
      const mockResult = {
        id: userId,
      };

      mockUsersService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(userId, mockReq);

      expect(mockUsersService.remove).toHaveBeenCalledWith(userId, requesterId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getProfile', () => {
    it('should call usersService.findOne with userId from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      mockUsersService.findOne.mockResolvedValue(mockResult);

      const result = await controller.getProfile(mockReq);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateProfile', () => {
    it('should call usersService.update with userId from request, flagged as self-service', async () => {
      const userId = 'user1';
      const updateUserDto = {
        name: 'Updated Name',
      };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: userId,
        ...updateUserDto,
      };

      mockUsersService.update.mockResolvedValue(mockResult);

      const result = await controller.updateProfile(mockReq, updateUserDto);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        {
          isSelfService: true,
        },
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteOwnAccount', () => {
    it('delega en usersService.deleteOwnAccount con el id del request', async () => {
      const userId = 'user1';
      const dto = { currentPassword: 'clave-actual' };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const mockResult = { message: 'Tu cuenta se eliminó correctamente' };

      mockUsersService.deleteOwnAccount.mockResolvedValue(mockResult);

      const result = await controller.deleteOwnAccount(mockReq, dto);

      expect(mockUsersService.deleteOwnAccount).toHaveBeenCalledWith(
        userId,
        dto,
      );
      expect(result).toEqual(mockResult);
    });

    it('no exige rol ADMIN (cualquier usuario autenticado puede borrarse)', () => {
      const reflector = new Reflector();
      const requiredRoles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        // Referencia usada solo como clave de metadatos, nunca invocada.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        UsersController.prototype.deleteOwnAccount,
        UsersController,
      ]);

      expect(requiredRoles).toBeUndefined();
    });

    // Garantía de la que depende todo el autoserborrado: si @Delete('me')
    // dejara de declararse antes de @Delete(':id'), Nest encajaría "me"
    // como :id del endpoint admin y devolvería 403 en silencio.
    it('declara la ruta "me" ANTES que ":id" para ganar el despacho', () => {
      // @nestjs/common define PATH_METADATA = 'path' sobre cada handler.
      const getPaths = (proto: object): string[] =>
        Object.getOwnPropertyNames(proto)
          .map((name) => {
            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            if (!descriptor?.value) return null;
            return (
              (Reflect.getMetadata('path', descriptor.value as object) as
                string | undefined) ?? null
            );
          })
          .filter((p): p is string => p !== null);

      const paths = getPaths(UsersController.prototype);
      expect(paths.indexOf('me')).toBeGreaterThanOrEqual(0);
      expect(paths.indexOf(':id')).toBeGreaterThanOrEqual(0);
      expect(paths.indexOf('me')).toBeLessThan(paths.indexOf(':id'));
    });
  });
});
