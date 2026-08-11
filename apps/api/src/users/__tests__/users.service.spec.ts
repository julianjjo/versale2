import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
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
    it('should update a user without password change', async () => {
      const userId = 'user1';
      const updateUserDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const mockUpdatedUser = {
        id: userId,
        ...updateUserDto,
        role: 'USER',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update(userId, updateUserDto);

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

      const mockUpdatedUser = {
        id: userId,
        email: 'user1@example.com',
        name: 'User 1',
        role: 'USER',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update(userId, updateUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockPrismaService.client.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedPassword },
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
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const userId = 'user1';
      const mockDeletedUser = {
        id: userId,
        email: 'user1@example.com',
        name: 'User 1',
      };

      mockPrismaService.client.user.delete.mockResolvedValue(mockDeletedUser);

      const result = await service.remove(userId);

      expect(mockPrismaService.client.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockDeletedUser);
    });
  });
});
