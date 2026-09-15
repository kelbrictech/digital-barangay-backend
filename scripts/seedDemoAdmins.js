// Seeds four DEMONSTRATION Admin accounts: ADM-0002, ADM-0003, ADM-0004,
// ADM-0005. Fictional profile names only. Credentials come entirely from
// environment variables — nothing plaintext is committed to source,
// printed beyond a confirmation line, or written to the frontend/README.
//
// Requires ADM-0001 (the real existing admin) to already be assigned via
// bootstrapExistingAdmin.js first — this script explicitly checks for that
// and refuses to run otherwise, so a demo account can never accidentally
// end up numbered ADM-0001.
//
// Usage — one password per demo admin, all four required:
//   DEMO_ADMIN_2_PASSWORD="..." \
//   DEMO_ADMIN_3_PASSWORD="..." \
//   DEMO_ADMIN_4_PASSWORD="..." \
//   DEMO_ADMIN_5_PASSWORD="..." \
//   node scripts/seedDemoAdmins.js
//
// NOT RUN as part of this BUILD pass — no live DB access was used. For
// ADAM to run under MIGRATE-DBA-001, after bootstrapExistingAdmin.js.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

const DEMO_ADMINS = [
  { staffId: 'ADM-0002', fullName: 'Rosario Mendez (Demo)', email: 'demo.admin2@vico.local', envVar: 'DEMO_ADMIN_2_PASSWORD' },
  { staffId: 'ADM-0003', fullName: 'Teodoro Villanueva (Demo)', email: 'demo.admin3@vico.local', envVar: 'DEMO_ADMIN_3_PASSWORD' },
  { staffId: 'ADM-0004', fullName: 'Josefa Ramirez (Demo)', email: 'demo.admin4@vico.local', envVar: 'DEMO_ADMIN_4_PASSWORD' },
  { staffId: 'ADM-0005', fullName: 'Nestor Aquino (Demo)', email: 'demo.admin5@vico.local', envVar: 'DEMO_ADMIN_5_PASSWORD' },
];

const run = async () => {
  const missing = DEMO_ADMINS.filter((d) => !process.env[d.envVar]);
  if (missing.length) {
    console.error('Missing env vars:', missing.map((d) => d.envVar).join(', '));
    process.exit(1);
  }

  const admin1 = await prisma.user.findUnique({ where: { staffId: 'ADM-0001' } });
  if (!admin1) {
    console.error('STOP: ADM-0001 is not assigned yet. Run bootstrapExistingAdmin.js first.');
    process.exit(1);
  }

  for (const demo of DEMO_ADMINS) {
    const conflict = await prisma.user.findFirst({
      where: { OR: [{ staffId: demo.staffId }, { email: demo.email }] },
    });
    if (conflict) {
      console.log(`Skipping ${demo.staffId} — already exists (${conflict.email}).`);
      continue;
    }

    const passwordHash = await bcrypt.hash(process.env[demo.envVar], 10);

    await prisma.user.create({
      data: {
        fullName: demo.fullName,
        email: demo.email,
        passwordHash,
        role: 'admin',
        staffId: demo.staffId,
        accountStatus: 'active',
      },
    });
    console.log(`Created ${demo.staffId} (${demo.email}).`);
  }

  // Bump the ADM counter so the next Webmaster-approved admin continues
  // from ADM-0006 rather than colliding with these fixed demo identities.
  // Read-then-write is fine here (unlike nextStaffId/nextTrackingNumber):
  // this is a one-time manual seed script, not a concurrent hot path, and
  // it only ever raises the counter, never lowers it.
  const counter = await prisma.staffIdCounter.findUnique({ where: { prefix: 'ADM' } });
  if (!counter) {
    await prisma.staffIdCounter.create({ data: { prefix: 'ADM', count: 5 } });
  } else if (counter.count < 5) {
    await prisma.staffIdCounter.update({ where: { prefix: 'ADM' }, data: { count: 5 } });
  }

  console.log('Demo admins seeded. ADM counter set to 5.');
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
