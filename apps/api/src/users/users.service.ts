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
import { BCRYPT_SALT_ROUNDS } from '../common/bcrypt';
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
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );
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
    let changesEmail = false;

    if (wantsPasswordChange || wantsEmailChange) {
      const currentUser = await this.prisma.client.user.findUnique({
        where: { id },
        select: { email: true, password: true },
      });
      if (!currentUser) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      changesEmail = nextEmail !== undefined && nextEmail !== currentUser.email;

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
      data.password = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    }

    // A verification only ever proved ownership of the *old* address — a new
    // one hasn't been proven yet. Without this, the profile badge kept
    // showing "Correo verificado" for an email that was never actually
    // verified, and any still-unconsumed token from before the change could
    // later re-verify that new, unproven address.
    const emailChangeResetsVerification = changesEmail
      ? { isVerified: false, verificationToken: null }
      : {};

    // A changed password must invalidate every JWT issued before it —
    // otherwise a token stolen earlier keeps working after the account is
    // "secured" via a password change.
    const passwordChangeInvalidatesTokens = wantsPasswordChange
      ? { tokenVersion: { increment: 1 } }
      : {};

    try {
      return await this.prisma.client.user.update({
        where: { id },
        data: {
          ...data,
          ...emailChangeResetsVerification,
          ...passwordChangeInvalidatesTokens,
        },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      translatePrismaError(error, {
        // The findUnique-then-throw email check above only drives that early
        // guard — two concurrent requests changing different users to the
        // same not-yet-taken email can both pass it before either writes. The
        // DB's unique constraint on User.email then rejects the losing write
        // with P2002, which must still read as the same Spanish 409 instead
        // of an unhandled 500.
        P2002: () => {
          throw new ConflictException('Ya existe una cuenta con ese correo');
        },
        // A non-credential update (e.g. just `name`) skips the findUnique
        // guard above entirely, since that guard only exists to check the
        // current password and the new email's availability. Without it,
        // updating an id that was deleted a moment earlier reaches Prisma's
        // update() directly, which raises P2025 for a matched-no-row write —
        // it must still read as the same 404 instead of an unhandled 500.
        P2025: () => {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        },
      });
    }
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta.');
    }

    try {
      // The admin-count check and the delete must happen inside one
      // transaction. Outside of one, two concurrent deletes targeting two
      // different admins — with exactly 2 admins left — could each read
      // adminCount === 2 before either writes, both pass the check below,
      // and both proceed to delete: zero admins left. Inside a transaction,
      // the second one's count only runs once the first's delete has
      // committed (or rolled back), so it always sees the up-to-date count.
      return await this.prisma.client.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        });
        if (!target) {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }

        if (target.role === Role.ADMIN) {
          const adminCount = await tx.user.count({
            where: { role: Role.ADMIN },
          });
          if (adminCount <= 1) {
            throw new ForbiddenException(
              'No puedes eliminar al último administrador.',
            );
          }
        }

        return await tx.user.delete({
          where: { id },
          select: PUBLIC_USER_SELECT,
        });
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
        // Product.sellerId, Order.userId, Review.userId, Cart.userId,
        // ProductReport.reporterId, and ProductQuestion.askerId are all ON
        // DELETE RESTRICT, so deleting a user with any of that activity
        // raises P2003. (ProductReport.reviewedById is the one exception —
        // it's ON DELETE SET NULL, so reviewing a report never blocks
        // deleting that admin's own account.) Without this handler it
        // surfaces as an English 500.
        P2003: () => {
          throw new BadRequestException(
            'No se puede eliminar a este usuario: tiene productos, pedidos, reseñas, favoritos, reportes, preguntas o un carrito asociados.',
          );
        },
      });
    }
  }
}
