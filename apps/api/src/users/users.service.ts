import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './role.enum';
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
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    options: { isSelfService?: boolean } = {},
  ) {
    const { currentPassword, ...data } = updateUserDto;
    const nextEmail = data.email;
    const wantsPasswordChange = data.password !== undefined;
    const wantsEmailChange = nextEmail !== undefined;

    if (wantsPasswordChange || wantsEmailChange) {
      const currentUser = await this.prisma.client.user.findUnique({
        where: { id },
        select: { email: true, password: true },
      });
      if (!currentUser) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      const changesEmail =
        nextEmail !== undefined && nextEmail !== currentUser.email;

      // A borrowed session must not be able to take over the account: when the
      // owner changes their own credentials they have to prove the current
      // password. Admins recovering another account are exempt.
      if (options.isSelfService && (wantsPasswordChange || changesEmail)) {
        if (!currentPassword) {
          throw new UnauthorizedException(
            'Debes confirmar tu contraseña actual para cambiar tu correo o tu contraseña',
          );
        }

        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          currentUser.password,
        );
        if (!isCurrentPasswordValid) {
          throw new UnauthorizedException('La contraseña actual es incorrecta');
        }
      }

      if (changesEmail) {
        const existingUser = await this.prisma.client.user.findUnique({
          where: { email: nextEmail },
        });
        if (existingUser) {
          throw new ConflictException('Ya existe una cuenta con ese correo');
        }
      }
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.client.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_SELECT,
    });
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta.');
    }

    const target = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (target.role === Role.ADMIN) {
      const adminCount = await this.prisma.client.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException(
          'No puedes eliminar al último administrador.',
        );
      }
    }

    return this.prisma.client.user.delete({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
  }
}
