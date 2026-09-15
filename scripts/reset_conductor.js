const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const p = new PrismaClient();

async function main() {
  const password = 'Conductor@123';
  const hash = await bcrypt.hash(password, 10);

  // Upsert conductor account
  const conductor = await p.user.upsert({
    where: { email: 'conductor@iiitdmj.ac.in' },
    update: {
      passwordHash: hash,
      mustChangePassword: false,
      active: true,
      role: 'CONDUCTOR',
    },
    create: {
      email: 'conductor@iiitdmj.ac.in',
      name: 'Main Conductor',
      rollNumber: 'COND-001',
      passwordHash: hash,
      mustChangePassword: false,
      role: 'CONDUCTOR',
      active: true,
    }
  });

  console.log(`✅ Conductor account ready:`);
  console.log(`   Email   : conductor@iiitdmj.ac.in`);
  console.log(`   Password: Conductor@123`);
  console.log(`   Role    : ${conductor.role}`);
  console.log(`   ID      : ${conductor.id}`);

  await p.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
