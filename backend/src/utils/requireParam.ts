import { ValidationError } from '../types/index.js';

/**
 * Narrows a route parameter to a single string.
 *
 * Express 5 types params as `string | string[]` for wildcard paths. None of
 * ours are, so anything else is a malformed request: a 400, not a crash. A real
 * check rather than a cast that lies to the compiler.
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
