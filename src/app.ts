import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRoutes from './modules/auth/Auth.routes';
import clientsRoutes from './modules/clients/Clients.routes';
import casesRoutes from './modules/cases/Cases.routes';
import documentsRoutes from './modules/documents/Documents.routes';

import { getPool } from './config/database';
import { errorHandler, notFoundHandler } from './middlewares/Error.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security: Helmet ─────────────────────────────────────────
// Sets ~15 HTTP headers that protect against common attacks:
// XSS, clickjacking, MIME sniffing, etc. One line of code,
// a lot of protection.
app.use(helmet());

// ─── Security: CORS ──────────────────────────────────────────
// Only the specified origin can call this API.
// Any other domain will be blocked by the browser.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─── Security: Rate limiting ─────────────────────────────────
// Global limiter — applies to all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

// Strict limiter — only for auth routes (prevents brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 10 login attempts per IP TODO: VARIABLE DE AMBIENTE
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

app.use(globalLimiter);

// ─── Body parsers ─────────────────────────────────────────────
// Parse JSON bodies — limit size to prevent payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Static files: uploaded documents ────────────────────────
// Serve uploaded files — only authenticated users should access
// these in production (add authenticate middleware here later)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Health check ─────────────────────────────────────────────
app.get('/health', async (_req: import('express').Request, res: import('express').Response) => {
  try {
    await getPool();
    res.json({
      success: true,
      message: 'JurisFile API is running',
      database: 'connected',
      environment: process.env.NODE_ENV,
    });
  } catch {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

// ─── Routes ───────────────────────────────────────────────────
// We'll import and register modules here as we build them.
// Each module is self-contained: routes + controller + service.
//
// Example (uncomment as we build each module):
// import authRoutes from './modules/auth/auth.routes';
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/documents', documentsRoutes);
// app.use('/api/hearings', hearingsRoutes);
// app.use('/api/users', usersRoutes);

// ─── Error handling ───────────────────────────────────────────
// These two must always be last — order matters in Express.
// notFoundHandler catches anything that didn't match a route.
// errorHandler catches anything that called next(error).
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────
async function bootstrap() {
  try {
    // Connect to DB before accepting any requests
    await getPool();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║        JurisFile API — Running         ║
╠════════════════════════════════════════╣
║  Port    : ${PORT}                        ║
║  Env     : ${process.env.NODE_ENV}                 ║
║  DB      : ${process.env.DB_NAME}                 ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1); // Exit if DB can't connect — no point running without it
  }
}

bootstrap();
