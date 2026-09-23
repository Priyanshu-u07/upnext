import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/index.js';

/**
 * Global error handler middleware.
 *
 * Catches all errors thrown in route handlers and returns
 * a consistent JSON error response.
 *
 * Format:
 * {
 *   "error": {
 *     "code": "QUEUE_CLOSED",
 *     "message": "Queue is not open for new tickets"
 *   }
 * }
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Unknown errors — log and return 500
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
