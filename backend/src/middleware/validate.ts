import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../types/index.js';

/**
 * Validation middleware factory.
 *
 * Takes a Zod schema and returns middleware that validates
 * req.params, req.body, and req.query against it.
 *
 * Usage:
 *   router.post('/join', validate(joinQueueSchema), controller.join);
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod 4 exposes the failures as `issues`. (`errors` was the Zod 3 name;
        // reading it here threw a TypeError that surfaced as a 500.)
        const message = error.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');

        // Must be a real ValidationError instance — errorHandler checks
        // `err instanceof AppError`, which a plain object literal fails.
        next(new ValidationError(message));
        return;
      }
      next(error);
    }
  };
}
