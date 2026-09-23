import { ValidationError } from '../types/index.js';

/**
 * Narrows a route parameter to a single string.
 *
 * Express 5 types `req.params` values as `string | string[]`, because a path
 * may contain wildcards that capture repeated segments. None of our paths do,
 * so anything other than a single string means a malformed request rather than
 * a server fault — a 400, not a crash.
 *
 * Zod already rejects bad params in `validate()` before a handler runs, so in
 * practice this never throws. It exists so the narrowing is a real check
 * instead of a cast that lies to the compiler.
 */
export function requireParam(
  value: string | string[] | undefined,
  name: string
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Invalid ${name}`);
  }
  return value;
}
