import prisma from '../lib/prisma.js';

/**
 * Shared setup for tests that talk to the real database.
 *
 * Each test starts from an empty schema rather than rolling back a transaction,
 * because the concurrency tests run genuinely parallel work and a shared
 * transaction would serialise exactly what they exist to exercise.
 */

/** Deletes everything, children before parents so foreign keys stay satisfied. */
export async function wipe(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

export interface Fixture {
  organizationId: string;
  serviceId: string;
  /** A registered patient, for the rules that only apply to known customers. */
  customerId: string;
}

export async function seedFixture(): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: { name: 'Test Clinic' },
  });

  const service = await prisma.service.create({
    data: {
      organizationId: organization.id,
      name: 'General Consultation',
      prefix: 'A',
      averageServiceTime: 10,
    },
  });

  const customer = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Test Patient',
      email: `patient-${crypto.randomUUID()}@example.com`,
      passwordHash: 'not-used-in-these-tests',
      role: 'CUSTOMER',
    },
  });

  return {
    organizationId: organization.id,
    serviceId: service.id,
    customerId: customer.id,
  };
}

/** Today at midnight, matching how the service keys a day's queue. */
export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
