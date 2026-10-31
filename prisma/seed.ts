import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from './generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
async function main() {
  for (const name of [UserRole.admin, UserRole.user]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('Reference roles seeded; no user accounts were created or changed.');
}
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
