import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3001;

/**
 * Server entry point.
 *
 * In Phase 3, this will also initialize Socket.IO
 * by attaching it to the HTTP server.
 */
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   Queue Management System — Backend API      ║
  ║   Running on: http://localhost:${PORT}           ║
  ║   Health:     http://localhost:${PORT}/api/health ║
  ╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default server;
