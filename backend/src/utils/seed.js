import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

async function main() {
  console.log('Seeding database...');

  const basic = await prisma.plan.upsert({
    where: { name: 'Basic' },
    update: {},
    create: { name: 'Basic', maxPages: 1, maxPostsPerDay: 1, aiTier: 'STANDARD', priceMonthly: 10 },
  });

  await prisma.plan.upsert({
    where: { name: 'Premium' },
    update: {},
    create: { name: 'Premium', maxPages: 5, maxPostsPerDay: 3, aiTier: 'PREMIUM', priceMonthly: 30 },
  });

  await prisma.adminSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@autopost.ai';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      planId: basic.id,
    },
  });

  console.log(`✅ Seed complete. Admin login: ${adminEmail} / ${adminPassword}`);
  console.log('⚠️  Change this password immediately after first login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
