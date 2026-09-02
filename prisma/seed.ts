import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from './generated/prisma/client';

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('❌ DATABASE_URL must be set in environment variables.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// MAIN
async function main() {
  console.log('🌱 Seeding roles and admin user...');

  // 1. Roles
  const roleMap: Record<string, string> = {};

  for (const name of [UserRole.admin, UserRole.user]) {
    const role =
      (await prisma.role.findFirst({ where: { name } })) ??
      (await prisma.role.create({ data: { name } }));

    roleMap[name] = role.id;
    console.log(`✅ Role ready: ${name} (ID: ${role.id})`);
  }

  // 2. Admin user
  const adminEmail = 'admin@example.com';

  const user = await prisma.user.upsert({
    where: {
      username: 'admin',
    },
    update: {
      email: adminEmail,
      roleId: roleMap[UserRole.admin],
      accountStatus: UserStatus.active,
    },
    create: {
      username: 'admin',
      email: adminEmail,
      password: await hashPassword('changeme123'),
      role: {
        connect: {
          id: roleMap[UserRole.admin],
        },
      },
      accountStatus: UserStatus.active,
      emailVerified: false,
    },
  });

  console.log(`✅ Admin user ready (${user.email})`);
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
