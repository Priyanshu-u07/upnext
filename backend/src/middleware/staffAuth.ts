import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../types/index.js';

/**
 * A shared key on the staff endpoints.
 *
 * This is a lock on the door, not an identity system. It stops a patient who
 * reads the network tab from calling the next person in, which is the actual
 * hole it exists to close. It does not say *which* member of staff acted, so it
 * cannot support an audit trail, and everyone at the desk shares one secret
 * that can only be rotated by editing the environment and restarting.
 *
 * Real accounts were scoped out of this project deliberately — the problems
 * worth solving here were concurrency and keeping three screens consistent, and
 * JWT plumbing would have added files without adding any of that. Anything
 * deployed to a real clinic needs per-user login before it handles a patient's
 * name.
 *
 * The key is never compiled into the frontend bundle. Staff type it once on the
 * dashboard and the browser keeps it; otherwise it would be readable by anyone
 * who opened devtools, which would make it decoration rather than a lock.
 */
export const requireStaffKey: RequestHandler = (req, _res, next) => {
  const expected = process.env.STAFF_KEY;

  // Fail closed. An unset key means the deployment is misconfigured, and the
  // safe reading of that is "nobody gets in", not "everybody does".
  if (!expected) {
    next(new AppError('Staff access is not configured', 500, 'STAFF_KEY_UNSET'));
    return;
  }

  const provided = req.header('x-staff-key') ?? '';

  if (!matches(provided, expected)) {
    next(new AppError('Staff key missing or incorrect', 401, 'UNAUTHORIZED'));
    return;
  }

  next();
};

/**
 * Compares in constant time.
 *
 * `===` on strings returns as soon as two characters differ, so how long it
 * takes leaks how much of the key was right. Not a realistic attack over the
 * internet, but comparing secrets this way costs one function and removes the
 * question.
 */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, which would leak the length.
  // Comparing the key against itself keeps the work constant either way.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }

  return timingSafeEqual(a, b);
}
