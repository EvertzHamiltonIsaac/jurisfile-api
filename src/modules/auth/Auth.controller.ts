import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './Auth.service';
import { ApiResponse } from '../../types';

// ─── Validation schemas ───────────────────────────────────────
// Zod validates and types the request body at the same time.
// If validation fails, we return 400 before hitting the service.
const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required.' })
    .email('Invalid email format.')
    .toLowerCase() // normalize to lowercase before comparing
    .max(150),
  password: z
    .string({ error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(100),
});

// ─── POST /api/auth/login ─────────────────────────────────────
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Validate request body
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.issues.map((e) => e.message),
      } as ApiResponse);
      return;
    }

    const { email, password } = parsed.data;
    const token = await authService.login(email, password);

    res.status(200).json({
      success: true,
      data: { token },
      message: 'Login successful.',
    } as ApiResponse<{ token: string }>);
  } catch (error) {
    // If the error is from our service (bad credentials, inactive account)
    // return 401. Any unexpected error goes to the global error handler.
    if (
      error instanceof Error &&
      (error.message.includes('Invalid email') ||
        error.message.includes('deactivated'))
    ) {
      res.status(401).json({
        success: false,
        message: error.message,
      } as ApiResponse);
      return;
    }
    next(error); // unexpected error → global error handler
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────
// Returns the current user's profile.
// The authenticate middleware already verified the token —
// req.user is guaranteed to exist here.
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const profile = await authService.getProfile(userId);

    // Never return password_hash to the client
    const { password_hash, ...safeProfile } = profile as typeof profile & {
      password_hash?: string;
    };

    res.status(200).json({
      success: true,
      data: safeProfile,
    } as ApiResponse);
  } catch (error) {
    next(error);
  }
}
