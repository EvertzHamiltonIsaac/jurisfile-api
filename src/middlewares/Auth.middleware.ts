import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, ApiResponse } from '../types/index';

// ─── Verify JWT ──────────────────────────────────────────────
// This middleware runs before any protected route handler.
// If the token is missing, expired, or tampered with → 401.
// If valid → attaches the decoded payload to req.user so
// every downstream handler knows who is making the request.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  // Token must come in the Authorization header as: Bearer <token>
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    } as ApiResponse);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as JwtPayload;
    console.log(decoded);
    req.user = decoded;
    next();
  } catch (error) {
    // We give the same generic message for all token errors.
    // Never reveal WHY a token failed — that's information for attackers.
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    } as ApiResponse);
  }
}

// ─── Role-based access control ───────────────────────────────
// Usage: router.delete('/:id', authenticate, authorize('Administrator'), handler)
// Accepts one or more allowed roles.
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      } as ApiResponse);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // 403 Forbidden — you are authenticated but not allowed
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      } as ApiResponse);
      return;
    }

    next();
  };
}
