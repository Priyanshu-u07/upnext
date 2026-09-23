import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

/**
 * Seeding is destructive and idempotent.
 *
 * It wipes the demo data and recreates it, all inside one transaction, so:
 * - running `npm run db:seed` twice leaves the same state as running it once
 * - a failure halfway through rolls back and leaves nothing behind
 *
 * The previous version used bare `create` calls, which meant the second run
 * failed on the unique email and left an orphaned Organization in the database.
 */
async function main() {
  console.log('🌱 Seeding database (this wipes existing demo data)...');

  await prisma.$transaction(async (tx) => {
    // ─── Wipe ────────────────────────────────────────────────
    // Children before parents, so foreign keys stay satisfied.
    await tx.auditLog.deleteMany();
    await tx.ticket.deleteMany();
    await tx.counter.deleteMany();
    await tx.queue.deleteMany();
    await tx.service.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();
    console.log('  ✓ Cleared existing data');

    // ─── Organization ──────────────────────────────────────────
    const org = await tx.organization.create({
      data: {
        name: 'City Health Clinic',
      },
    });
    console.log(`  ✓ Organization: ${org.name}`);

    // ─── Staff Users ───────────────────────────────────────────
    // Password: "password123" — hashed with bcrypt later in Phase 5
    // For now, store a placeholder hash
    const staffUser = await tx.user.create({
      data: {
        organizationId: org.id,
        name: 'Dr. Sharma',
        email: 'staff@clinic.com',
        passwordHash: '$placeholder_will_be_bcrypt_in_phase5',
        role: 'STAFF',
      },
    });
    console.log(`  ✓ Staff: ${staffUser.name} (${staffUser.email})`);

    const staffUser2 = await tx.user.create({
      data: {
        organizationId: org.id,
        name: 'Dr. Patel',
        email: 'staff2@clinic.com',
        passwordHash: '$placeholder_will_be_bcrypt_in_phase5',
        role: 'STAFF',
      },
    });
    console.log(`  ✓ Staff: ${staffUser2.name} (${staffUser2.email})`);

    // ─── Services ──────────────────────────────────────────────
    const generalService = await tx.service.create({
      data: {
        organizationId: org.id,
        name: 'General Consultation',
        prefix: 'A',
        averageServiceTime: 10, // 10 minutes average
      },
    });
    console.log(`  ✓ Service: ${generalService.name} (prefix: ${generalService.prefix})`);

    const labService = await tx.service.create({
      data: {
        organizationId: org.id,
        name: 'Lab Tests',
        prefix: 'B',
        averageServiceTime: 5, // 5 minutes average
      },
    });
    console.log(`  ✓ Service: ${labService.name} (prefix: ${labService.prefix})`);

    // ─── Counters ──────────────────────────────────────────────
    const counter1 = await tx.counter.create({
      data: {
        serviceId: generalService.id,
        name: 'Counter 1',
        staffId: staffUser.id,
      },
    });
    console.log(`  ✓ Counter: ${counter1.name} → ${staffUser.name}`);

    const counter2 = await tx.counter.create({
      data: {
        serviceId: generalService.id,
        name: 'Counter 2',
        staffId: staffUser2.id,
      },
    });
    console.log(`  ✓ Counter: ${counter2.name} → ${staffUser2.name}`);

    const labCounter = await tx.counter.create({
      data: {
        serviceId: labService.id,
        name: 'Lab Counter',
      },
    });
    console.log(`  ✓ Counter: ${labCounter.name}`);

    // ─── Today's Queues ────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    await tx.queue.create({
      data: {
        serviceId: generalService.id,
        date: today,
        status: 'OPEN',
      },
    });
    console.log(`  ✓ Queue: General Consultation (${today.toLocaleDateString()})`);

    await tx.queue.create({
      data: {
        serviceId: labService.id,
        date: today,
        status: 'OPEN',
      },
    });
    console.log(`  ✓ Queue: Lab Tests (${today.toLocaleDateString()})`);
  });

  console.log('\n✅ Seed complete!');
  console.log('\nDemo data:');
  console.log(`  Organization: City Health Clinic`);
  console.log(`  Services: General Consultation (A-xx), Lab Tests (B-xx)`);
  console.log(`  Staff: staff@clinic.com, staff2@clinic.com`);
  console.log(`  Counters: Counter 1, Counter 2, Lab Counter`);
  console.log(`  Queues: Open for today`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
