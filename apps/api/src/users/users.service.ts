import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: {
    email: string;
    name: string;
    password: string;
  }) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.client.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
      },
    });
  }

  async findAll(query: any = {}) {
    const { search, role, page = 1, limit = 10 } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      const term = String(search);
      where.OR = [{ name: { contains: term } }, { email: { contains: term } }];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: PUBLIC_USER_SELECT,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const data: UpdateUserDto = {
      ...updateUserDto,
    };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.prisma.client.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_SELECT,
    });
  }

  remove(id: string) {
    return this.prisma.client.user.delete({ where: { id } });
  }
}
