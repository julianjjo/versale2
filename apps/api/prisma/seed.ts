import { PrismaClient, Role } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Versale Admin';

if (IS_PRODUCTION && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
  console.error(
    '[seed] Refusing to run in production without explicit ADMIN_EMAIL and ADMIN_PASSWORD. ' +
      'Set them in your secret manager, never in source control.\n' +
      'Example:\n' +
      '  ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=$(openssl rand -base64 32) npm run seed',
  );
  process.exit(1);
}

const RESOLVED_ADMIN_EMAIL = ADMIN_EMAIL ?? 'admin@versale.local';
const RESOLVED_ADMIN_PASSWORD = ADMIN_PASSWORD ?? 'admin12345';

if (!IS_PRODUCTION && ADMIN_PASSWORD && ADMIN_PASSWORD.length < 12) {
  console.warn(
    `[seed] WARNING: ADMIN_PASSWORD for "${RESOLVED_ADMIN_EMAIL}" is shorter than 12 chars. ` +
      'Use a strong password in production.',
  );
}

const DEMO_USERS = IS_PRODUCTION
  ? []
  : [
      {
        email: 'user@versale.local',
        password: 'user12345',
        name: 'Demo User',
        role: Role.USER,
      },
      {
        email: 'seller@versale.local',
        password: 'seller12345',
        name: 'Demo Seller',
        role: Role.USER,
      },
    ];

export async function seed() {
  const adminHash = await bcrypt.hash(RESOLVED_ADMIN_PASSWORD, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: RESOLVED_ADMIN_EMAIL },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: RESOLVED_ADMIN_EMAIL,
        password: adminHash,
        name: ADMIN_NAME,
        role: Role.ADMIN,
      },
    });
    console.log(`Created admin: ${RESOLVED_ADMIN_EMAIL}`);
  } else if (existingAdmin.role !== Role.ADMIN) {
    await prisma.user.update({
      where: { email: RESOLVED_ADMIN_EMAIL },
      data: { role: Role.ADMIN, password: adminHash },
    });
    console.log(`Promoted existing user to admin: ${RESOLVED_ADMIN_EMAIL}`);
  } else {
    console.log(`Admin already exists: ${RESOLVED_ADMIN_EMAIL}`);
  }

  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { ...u, password: hash },
    });
    console.log(`Created demo user: ${u.email} / ${u.password}`);
  }
}

if (require.main === module) {
  seed()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      return prisma.$disconnect().then(() => process.exit(1));
    });
}
