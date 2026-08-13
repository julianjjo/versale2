import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './role.enum';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';
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
    const { search, role, page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: any = {};
    if (search) {
      const term = String(search);
      where.OR = [{ name: { contains: term } }, { email: { contains: term } }];
    }
    // Prisma rejects a value outside the enum with an unhandled error, so an
    // unknown `?role=` is ignored rather than passed through.
    if (role && Object.values(Role).includes(role as Role)) {
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
          // 403, not 401: the bearer token is still valid, only the supplied
          // password is missing. A 401 here would make the web app's global
          // interceptor treat this as an expired session and log the user out.
          throw new ForbiddenException(
            'Debes confirmar tu contraseña actual para cambiar tu correo o tu contraseña',
          );
        }

        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          currentUser.password,
        );
        if (!isCurrentPasswordValid) {
          // Same reasoning: a wrong currentPassword is a 403, not a 401.
          throw new ForbiddenException('La contraseña actual es incorrecta');
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

    try {
      return await this.prisma.client.user.update({
        where: { id },
        data,
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      // The findUnique-then-throw email check above only drives that early
      // guard — two concurrent requests changing different users to the same
      // not-yet-taken email can both pass it before either writes. The DB's
      // unique constraint on User.email then rejects the losing write with
      // P2002, which must still read as the same Spanish 409 instead of an
      // unhandled 500.
      translatePrismaError(error, {
        P2002: () => {
          throw new ConflictException('Ya existe una cuenta con ese correo');
        },
      });
    }
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

    try {
      return await this.prisma.client.user.delete({
        where: { id },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      translatePrismaError(error, {
        // The findUnique above only drives the 404/admin-count checks — a
        // second concurrent delete of the same target (a double-click before
        // the button disables, or two admin sessions) makes this delete
        // match no row. Prisma raises P2025 for that; it must still read as
        // the same 404 instead of an unhandled 500.
        P2025: () => {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        },
        // Product.sellerId, Order.userId, Review.userId and Cart.userId are
        // all ON DELETE RESTRICT, so deleting a user with any of that
        // activity raises P2003. Without this handler it surfaces as an
        // English 500.
        P2003: () => {
          throw new BadRequestException(
            'No se puede eliminar a este usuario: tiene productos, pedidos, reseñas o un carrito asociados.',
          );
        },
      });
    }
  }
}
