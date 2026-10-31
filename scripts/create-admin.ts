import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../prisma/generated/prisma/client';

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error(
      'Set DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD before provisioning',
    );
  }
  if (ADMIN_PASSWORD.length < 12 || Buffer.byteLength(ADMIN_PASSWORD) > 72) {
    throw new Error('ADMIN_PASSWORD must have at least 12 characters and at most 72 UTF-8 bytes');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  try {
    const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.$transaction(async (db) => {
      const existing = await db.user.findFirst({
        where: { OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }] },
      });
      if (existing)
        throw new Error(
          'Account already exists; provisioning never changes or elevates existing accounts',
        );
      const role = await db.role.upsert({
        where: { name: UserRole.admin },
        update: {},
        create: { name: UserRole.admin },
      });
      await db.user.create({
        data: {
          email: ADMIN_EMAIL,
          username: ADMIN_USERNAME,
          password,
          roleId: role.id,
        },
      });
    });
    console.log('Administrator created.');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
