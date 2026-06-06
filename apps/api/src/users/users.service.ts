import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  findAll() {
    return this.prisma.client.user.findMany({ select: PUBLIC_USER_SELECT });
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

  async update(
    id: string,
    updateUserDto: { password?: string; name?: string; email?: string },
  ) {
    const data: { password?: string; name?: string; email?: string } = {
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
