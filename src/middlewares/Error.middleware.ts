import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index';
import { AppError } from '../config/AppError';

// ─── Global error handler ────────────────────────────────────
// Express calls this automatically when any route calls next(error).
// Having one central place means:
// 1. Consistent error format across all endpoints
// 2. We never accidentally leak stack traces in production
// 3. Easy to add logging later (Sentry, Winston, etc.)
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // In development show the stack trace, in production hide it
  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: isDev ? err.message : 'An internal server error occurred.',
    ...(isDev && { stack: err.stack }),
  } as ApiResponse);
}

// ─── 404 handler ─────────────────────────────────────────────
// Catches any request that didn't match a registered route
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  } as ApiResponse);
}
