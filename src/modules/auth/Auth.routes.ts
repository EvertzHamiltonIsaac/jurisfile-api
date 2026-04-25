import { Router } from 'express';
import * as authController from './Auth.controller';
import { authenticate } from '../../middlewares/Auth.middleware';

const router = Router();

// POST /api/auth/login
// Public — no authentication required
// Rate limiter is applied at app.ts level for this router
router.post('/login', authController.login);

// GET /api/auth/me
// Protected — requires a valid JWT token
// Used by the frontend on page load to restore the session
router.get('/me', authenticate, authController.getMe);

export default router;
