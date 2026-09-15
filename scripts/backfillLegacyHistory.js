// One-time backfill (DEC-DBA-022): gives every pre-v1.1.0 request and
// concern exactly one baseline RequestStatusHistory / ConcernStatusHistory
// row, representing the migration boundary — not a reconstruction of real
// history, which the legacy JSON field doesn't preserve with per-Admin
// attribution anyway.
//
//   fromStatus   = null
//   toStatus     = <the record's current status, unchanged>
//   actorUserId  = null
//   actorType    = 'system'
//   actorStaffId = null
//   note         = 'Imported from VICO v1.0.0'
//
// The legacy DocumentRequest.statusHistory JSON field is never read,
// rewritten, or deleted by this script — it's left exactly as-is.
//
// Idempotent: only touches requests/concerns that currently have zero
// history rows, so it's safe to re-run after new v1.1.0 records (which
// already get history at creation time) exist alongside old ones.
//
// NOT RUN as part of this BUILD pass — no live DB access was used. For
// ADAM to run under MIGRATE-DBA-001, ideally against a staging copy first.

require('dotenv').config();
const prisma = require('../src/config/prisma');

const run = async () => {
  const [requestsMissingHistory, concernsMissingHistory] = await Promise.all([
    prisma.documentRequest.findMany({ where: { history: { none: {} } } }),
    prisma.concern.findMany({ where: { history: { none: {} } } }),
  ]);

  if (!requestsMissingHistory.length && !concernsMissingHistory.length) {
    console.log('Nothing to backfill — every request and concern already has history.');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const r of requestsMissingHistory) {
      await tx.requestStatusHistory.create({
        data: {
          requestId: r.id,
          fromStatus: null,
          toStatus: r.status,
          actorUserId: null,
          actorType: 'system',
          actorStaffId: null,
          note: 'Imported from VICO v1.0.0',
        },
      });
    }

    for (const c of concernsMissingHistory) {
      await tx.concernStatusHistory.create({
        data: {
          concernId: c.id,
          fromStatus: null,
          toStatus: c.status,
          actorUserId: null,
          actorType: 'system',
          actorStaffId: null,
          note: 'Imported from VICO v1.0.0',
        },
      });
    }
  });

  console.log(
    `Backfilled baseline history for ${requestsMissingHistory.length} request(s) and ${concernsMissingHistory.length} concern(s).`
  );
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
