import { beforeEach, describe, expect, it } from 'vitest';
import * as queueService from '../services/queue.service.js';
import { seedFixture, wipe } from './helpers.js';

/**
 * What happens when two things occur at the same instant.
 *
 * These talk to a real Postgres on purpose. The races being tested here are
 * properties of the database's isolation level, so a mocked client would prove
 * nothing — it would happily report that code is correct when it is not.
 */

let serviceId: string;

beforeEach(async () => {
  await wipe();
  ({ serviceId } = await seedFixture());
});

describe('joining a queue', () => {
  it('issues sequential tokens one at a time', async () => {
    const first = await queueService.joinQueue(serviceId);
    const second = await queueService.joinQueue(serviceId);

    expect(first.tokenNumber).toBe(1);
    expect(first.tokenDisplay).toBe('A-01');
    expect(second.tokenNumber).toBe(2);
    expect(second.position).toBe(1);
  });

  /**
   * The headline test.
   *
   * A hundred is not an arbitrary number — it is a day at the clinic this was
   * built for. If a morning rush of patients can make the system hand out the
   * same token twice, or refuse to hand one out at all, nothing else about it
   * matters.
   */
  it('gives a hundred simultaneous patients a hundred different tokens', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () => queueService.joinQueue(serviceId)),
    );

    const issued = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');

    // Reported before the assertions so a failing run says how badly it failed,
    // not just that it did.
    console.log(
      `\n  issued ${issued.length}/100, refused ${refused.length}` +
        (refused.length
          ? `\n  first failure: ${(refused[0] as PromiseRejectedResult).reason?.message ?? 'unknown'}`
          : ''),
    );

    expect(refused).toHaveLength(0);

    const tokens = (issued as PromiseFulfilledResult<{ tokenNumber: number }>[]).map(
      (r) => r.value.tokenNumber,
    );
    expect(new Set(tokens).size).toBe(100);

    // Sequential with no gaps: patients notice a queue that skips numbers.
    expect([...tokens].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1),
    );
  });
});

describe('calling the next patient', () => {
  /**
   * Two counters, one button each, pressed together.
   *
   * Worse than the join race, because nothing in the schema catches it: both
   * reads find the same WAITING ticket and both updates succeed, so the second
   * write silently wins and two counters call the same person.
   */
  it('never gives the same patient to two counters', async () => {
    await Promise.all(Array.from({ length: 5 }, () => queueService.joinQueue(serviceId)));

    const [a, b] = await Promise.all([
      queueService.callNext(serviceId),
      queueService.callNext(serviceId),
    ]);

    console.log(`\n  counter 1 called ${a.tokenDisplay}, counter 2 called ${b.tokenDisplay}`);

    expect(a.id).not.toBe(b.id);
    expect(a.tokenNumber).not.toBe(b.tokenNumber);
  });
});
