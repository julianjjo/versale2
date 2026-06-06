import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { AuthRequest } from '../../../src/types/request.types';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call usersService.findAll', async () => {
      const mockResult = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
        },
      ];

      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalledWith();
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

      expect(usersService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
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

      expect(usersService.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('should call usersService.remove with id', async () => {
      const userId = 'user1';
      const mockResult = {
        id: userId,
      };

      mockUsersService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(userId);

      expect(usersService.remove).toHaveBeenCalledWith(userId);
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

      expect(usersService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateProfile', () => {
    it('should call usersService.update with userId from request and updateUserDto', async () => {
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

      expect(usersService.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toEqual(mockResult);
    });
  });
});
