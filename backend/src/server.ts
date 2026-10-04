import 'dotenv/config';
import { createServer } from 'node:http';
import app from './app.js';
import { initSocket } from './socket/socketManager.js';

const PORT = process.env.PORT || 3001;

/**
 * Server entry point.
 *
 * Express no longer creates the listener itself: Socket.IO has to attach to
 * the same HTTP server so that the WebSocket upgrade handshake and the REST
 * API share one port.
 */
const server = createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   UpNext — Backend API                       ║
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
