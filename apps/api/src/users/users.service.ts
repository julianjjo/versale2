import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { Role } from '@prisma/client';
import { OrderStatus } from '../orders/order-status.enum';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

// Borrado de cuenta: identidad sustituta tras el anonimizado. El uuid de la
// propia fila garantiza que el correo sustituto nunca colisione con el
// @unique de otro usuario (ni consigo mismo en un segundo intento), y
// `.invalid` es un TLD reservado que ningún MX puede recibir.
const ANONYMIZED_NAME = 'Usuario eliminado';
const anonymizedEmail = (userId: string) =>
  `eliminado-${userId}@anonymized.invalid`;

// La dirección de envío sobrevive dentro de la orden mientras pueda servir a
// una disputa o devolución — exactamente la misma ventana de 30 días tras
// DELIVERED que cierra las disputas (ítem 12). Pasado ese plazo, es PII sin
// propósito y se redacta.
export const ADDRESS_RETENTION_DAYS = 30;
export const REDACTED_SHIPPING_ADDRESS = {
  eliminada:
    'Dirección de envío eliminada: la cuenta fue borrada y el plazo de conservación terminó',
};

// Predicado compartido por la pasada inmediata (dentro de la transacción de
// borrado, acotada al propio usuario) y el barrido horario (todos los usuarios
// ya borrados): una orden es redactable cuando ya no puede mover mercancía ni
// dinero — cancelada o reembolsada — o cuando su entrega prescribió.
function addressRedactableWhere(
  scope: { userId: string } | { deletedUser: true },
  now = new Date(),
): Prisma.OrderWhereInput {
  const cutoff = new Date(
    now.getTime() - ADDRESS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  return {
    ...('userId' in scope ? { userId: scope.userId } : {}),
    ...('deletedUser' in scope
      ? { user: { deletedAt: { not: null } as const } }
      : {}),
    shippingAddressRedactedAt: null,
    OR: [
      { status: { in: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
      { deliveredAt: { lte: cutoff } },
    ],
  };
}

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
export class UsersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersService.name);
  private redactInterval?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Barrido horario — intervalo nativo, sin @nestjs/schedule (mismo
    // patrón que OrdersService).
    this.redactInterval = setInterval(
      () => {
        void this.redactAddressesForDeletedAccounts();
      },
      60 * 60 * 1000,
    );
    // Allow process to exit even if interval is still scheduled (tests, e2e)
    if (this.redactInterval.unref) this.redactInterval.unref();
  }

  onModuleDestroy() {
    if (this.redactInterval) clearInterval(this.redactInterval);
  }

  async create(createUserDto: {
    email: string;
    name: string;
    password: string;
  }) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);
    return this.prisma.client.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
      },
    });
  }

  async findAll(query: Record<string, unknown> = {}) {
    const { search, role, page, limit, deleted } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: Prisma.UserWhereInput = {};
    // Las cuentas anonimizadas («Usuario eliminado») no son usuarios del
    // panel: se excluyen por defecto. ?deleted=true las lista explícitamente
    // para auditoría.
    if (deleted === 'true') {
      where.deletedAt = { not: null };
    } else if (deleted === 'all') {
      // Sin filtro: auditoría completa.
    } else {
      where.deletedAt = null;
    }
    if (typeof search === 'string' && search) {
      const term = search;
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

    // Una cuenta anonimizada no se puede "actualizar": repueblar su email o
    // nombre reales rompería el invariante de que tras el borrado la fila no
    // contiene PII (aunque el login siga bloqueado por deletedAt).
    const existingRow = await this.prisma.client.user.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!existingRow || existingRow.deletedAt) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

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
      data.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    // A verification only ever proved ownership of the *old* address — a new
    // one hasn't been proven yet. Without this, the profile badge kept
    // showing "Correo verificado" for an email that was never actually
    // verified, and any still-unconsumed token from before the change could
    // later re-verify that new, unproven address. Item 17: la expiración del
    // token viejo también se limpia junto con él.
    const emailChangeResetsVerification = changesEmail
      ? {
          isVerified: false,
          verificationToken: null,
          verificationTokenExpires: null,
        }
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

  /**
   * Autoserborrado de cuenta (DELETE /users/me): exige la contraseña actual,
   * impide que el último administrador abandone el marketplace sin sucesión,
   * y delega en la misma anonimización que usa el borrado admin. El usuario
   * conserva sesión activa hasta que la respuesta llegue — el bump de
   * tokenVersion dentro de la transacción invalida todos sus JWT de inmediato.
   */
  async deleteOwnAccount(id: string, dto: DeleteAccountDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, password: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      // Segunda barrera (JwtStrategy ya bloquea el token): una cuenta
      // borrada no vuelve a pasar por aquí ni por error de carrera.
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      // 403, no 401: el token sigue siendo válido, solo falla la contraseña
      // — un 401 dispararía el logout global del interceptor del frontend.
      throw new ForbiddenException('La contraseña actual es incorrecta');
    }

    await this.anonymizeUserInTransaction(id);
    return { message: 'Tu cuenta se eliminó correctamente' };
  }

  /**
   * Anonimización de una cuenta dentro de UNA transacción: o todo se aplica
   * (productos retirados, datos personales borrados, identidad sustituida) o
   * nada — dejar la mitad hecha sería peor que cualquiera de los dos extremos
   * (un usuario "borrado" cuyo correo sigue activo, o una cuenta viva sin
   * contraseña). La fila nunca desaparece: órdenes, reseñas, preguntas y
   * reportes la referencian con FK RESTRICT y son registros que el
   * marketplace debe conservar.
   *
   * Orden deliberado contra el TOCTOU del guardia de último admin: la
   * PRIMERA escritura (el propio user.update) adquiere ya el lock de
   * escritura de SQLite, así que dos admins que se borran a la vez se
   * serializan — el segundo cuenta admins DESPUÉS de que el primero
   * commitó, ve cero vivos y su transacción entera revierte.
   */
  private async anonymizeUserInTransaction(id: string): Promise<void> {
    // Fuera de la transacción: bcrypt puro-JS (~100 ms) no debe retener el
    // lock de escritura de SQLite.
    const replacementPasswordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString('hex'),
      BCRYPT_ROUNDS,
    );

    await this.prisma.client.$transaction(async (tx) => {
      // La PII de la propia fila se sobrescribe, no se borra: el email
      // sustituto libera el original para un futuro registro, el hash
      // aleatorio hace imposible cualquier login residual, los tokens
      // nulos cierran los flujos de verificación/reset a medio hacer y el
      // bump de tokenVersion expulsa todas las sesiones abiertas al vuelo.
      // role pasa a USER: un admin anonimizado no puede seguir contando
      // como admin vivo en ninguna guardia.
      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          name: ANONYMIZED_NAME,
          email: anonymizedEmail(id),
          password: replacementPasswordHash,
          role: Role.USER,
          isVerified: false,
          verificationToken: null,
          verificationTokenExpires: null,
          resetToken: null,
          resetTokenExpires: null,
          tokenVersion: { increment: 1 },
        },
      });

      // Guardia post-escritura: si al contar SOLO admins vivos quedara
      // ninguno, la excepción revierte toda la transacción (incluido el
      // update anterior).
      const liveAdminCount = await tx.user.count({
        where: { role: Role.ADMIN, deletedAt: null },
      });
      if (liveAdminCount === 0) {
        throw new ForbiddenException(
          'No puedes eliminar al último administrador.',
        );
      }

      // Prendas únicas aún a la venta: fuera del catálogo. updateMany por
      // sellerId (indexado); las SOLD conservan su historia intacta.
      await tx.product.updateMany({
        where: { sellerId: id, status: 'AVAILABLE' },
        data: { status: 'WITHDRAWN' },
      });

      // Datos personales sin valor comunitario ni transaccional: fuera.
      // Reseñas, preguntas y reportes NO se tocan: contenido comunitario e
      // historial que queda atribuido a «Usuario eliminado».
      await tx.cartItem.deleteMany({ where: { cart: { userId: id } } });
      await tx.cart.deleteMany({ where: { userId: id } });
      await tx.favorite.deleteMany({ where: { userId: id } });
      await tx.reviewHelpfulVote.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });

      // Direcciones ya prescribidas: redacción inmediata; el resto queda
      // para el barrido horario cuando venza su ventana.
      await tx.order.updateMany({
        where: addressRedactableWhere({ userId: id }),
        data: {
          shippingAddress: REDACTED_SHIPPING_ADDRESS,
          shippingAddressRedactedAt: new Date(),
        },
      });
    });
  }

  /**
   * Barrido horario: redacta direcciones de envío de cuentas borradas cuya
   * ventana de conservación venció después del propio borrado (p. ej. una
   * orden DELIVERED tres días antes de eliminar la cuenta prescribe 27 días
   * más tarde). Público para poder probarlo sin avanzar el reloj.
   */
  async redactAddressesForDeletedAccounts(): Promise<number> {
    const { count } = await this.prisma.client.order.updateMany({
      where: addressRedactableWhere({ deletedUser: true }),
      data: {
        shippingAddress: REDACTED_SHIPPING_ADDRESS,
        shippingAddressRedactedAt: new Date(),
      },
    });
    if (count > 0) {
      this.logger.log(
        `Direcciones de envío redactadas en ${count} pedido(s) de cuentas eliminadas`,
      );
    }
    return count;
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta.');
    }

    const target = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!target || target.deletedAt) {
      // Re-anonimizar una fila ya anonimizada sobrescribiría su sello con
      // otra fecha y otro hash sin ningún beneficio: se lee como 404.
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // El admin no borra físicamente: pasa por la misma anonimización que el
    // autoserborrado. Un delete físico de un usuario con productos, órdenes o
    // reseñas revienta por FK RESTRICT (el antiguo handler P2003 devolvía un
    // 400 y el usuario quedaba indestructible justamente cuando había que
    // moderarlo); anonimizar cumple la solicitud sin romper el historial.
    await this.anonymizeUserInTransaction(id);
    return { message: `Cuenta de ${id} anonimizada correctamente` };
  }
}
