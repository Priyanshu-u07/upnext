import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../types/index.js';

/**
 * A shared key on the staff endpoints.
 *
 * A lock on the door, not an identity system: it stops a patient calling the
 * next person in, but cannot say which staff member acted. Real deployment
 * needs per-user accounts.
 *
 * Staff type the key into the dashboard once. It is never compiled into the
 * frontend bundle, where any patient could read it from devtools.
 */
export const requireStaffKey: RequestHandler = (req, _res, next) => {
  const expected = process.env.STAFF_KEY;

  // Fail closed: an unset key is a misconfiguration, not an open door.
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

/** Constant time: `===` returns early on the first differing character. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // Throws on a length mismatch, which would itself leak the length.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }

  return timingSafeEqual(a, b);
}
