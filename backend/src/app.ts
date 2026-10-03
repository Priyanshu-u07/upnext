import express from 'express';
import cors from 'cors';
import queueRoutes from './routes/queue.routes.js';
import staffRoutes from './routes/staff.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireStaffKey } from './middleware/staffAuth.js';

const app = express();

// ─── Middleware ──────────────────────────────────────────────

// CORS: allow frontend dev server
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Customer-facing routes
app.use('/api', queueRoutes);

// Staff-facing routes. The guard is mounted here rather than on each route so
// a new staff endpoint is protected by default instead of by remembering.
app.use('/api/staff', requireStaffKey, staffRoutes);

// ─── Error Handling ─────────────────────────────────────────
app.use(errorHandler);

export default app;
