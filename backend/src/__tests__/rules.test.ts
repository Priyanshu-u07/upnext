import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../lib/prisma.js';
import * as queueService from '../services/queue.service.js';
import { seedFixture, startOfToday, wipe } from './helpers.js';

/**
 * The rules the queue is supposed to hold to, apart from concurrency.
 *
 * Each of these is a thing that would be an argument at the reception desk if
 * the system got it wrong.
 */

let serviceId: string;
let customerId: string;

beforeEach(async () => {
  await wipe();
  const fixture = await seedFixture();
  serviceId = fixture.serviceId;
  customerId = fixture.customerId;
});

describe('a queue that is not open', () => {
  it('refuses new patients when closed', async () => {
    // Joining once opens today's queue, so there is something to close.
    await queueService.joinQueue(serviceId);
    await prisma.queue.updateMany({
      where: { serviceId, date: startOfToday() },
      data: { status: 'CLOSED' },
    });

    await expect(queueService.joinQueue(serviceId)).rejects.toThrow(/closed/i);

    // And no half-made ticket was left behind.
    expect(await prisma.ticket.count()).toBe(1);
  });
});

describe('ticket state transitions', () => {
  it('will not complete a patient who was never called', async () => {
    const ticket = await queueService.joinQueue(serviceId);

    await expect(queueService.completeTicket(ticket.id)).rejects.toThrow(/cannot complete/i);

    const unchanged = await queueService.getTicket(ticket.id);
    expect(unchanged.status).toBe('WAITING');
  });

  /**
   * The flow that exists because of what happens in the real clinic: miss your
   * name and you go to the back of the line. Here you are skipped, and staff
   * can call you back in without you losing your token.
   */
  it('lets a skipped patient be called back in', async () => {
    await queueService.joinQueue(serviceId);
    const called = await queueService.callNext(serviceId);
    expect(called.status).toBe('CALLED');

    const skipped = await queueService.skipTicket(called.id);
    expect(skipped.status).toBe('SKIPPED');

    const recalled = await queueService.recallTicket(called.id);
    expect(recalled.status).toBe('CALLED');

    // The whole point: the same token, not a new one at the back.
    expect(recalled.tokenNumber).toBe(called.tokenNumber);
  });
});

describe('one active ticket per customer', () => {
  it('returns the existing ticket instead of issuing a second', async () => {
    const first = await queueService.joinQueue(serviceId, customerId);
    const second = await queueService.joinQueue(serviceId, customerId);

    expect(second.id).toBe(first.id);
    expect(await prisma.ticket.count()).toBe(1);
  });

  /**
   * The double-tap. A patient on a slow connection taps Join twice and both
   * requests pass the "do you already have a ticket?" check before either
   * inserts. The application check cannot close that window; the partial unique
   * index can.
   */
  it('issues one ticket when the same patient taps Join twice at once', async () => {
    const [a, b] = await Promise.all([
      queueService.joinQueue(serviceId, customerId),
      queueService.joinQueue(serviceId, customerId),
    ]);

    expect(a.id).toBe(b.id);
    expect(await prisma.ticket.count()).toBe(1);
  });

  it('lets them join again once their previous visit is finished', async () => {
    const first = await queueService.joinQueue(serviceId, customerId);
    await queueService.callNext(serviceId);
    await queueService.completeTicket(first.id);

    const second = await queueService.joinQueue(serviceId, customerId);

    expect(second.id).not.toBe(first.id);
    expect(second.tokenNumber).toBe(first.tokenNumber + 1);
  });
});
