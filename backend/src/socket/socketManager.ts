import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import * as queueService from '../services/queue.service.js';
import {
  queueRoom,
  type ClientToServerEvents,
  type QueueAction,
  type ServerToClientEvents,
} from './events.js';

/**
 * Socket.IO lives here and nowhere else. queue.service.ts never imports it —
 * controllers emit after the service returns, so the business logic stays
 * runnable without a listening port, which is what the concurrency tests need.
 */

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/** Per-service event counter, so clients can discard out-of-order deliveries. */
const sequences = new Map<string, number>();

export function initSocket(httpServer: HttpServer): void {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {

    socket.on('queue:subscribe', (serviceId) => {
      void socket.join(queueRoom(serviceId));
    });

    socket.on('queue:unsubscribe', (serviceId) => {
      void socket.leave(queueRoom(serviceId));
    });
  });

  console.log('  Socket.IO ready');
}

/**
 * Tells everyone watching this queue that it changed.
 *
 * Reads the state itself rather than taking it from the caller, so a broadcast
 * can never disagree with the database. A failure here must not fail the HTTP
 * request: the write has committed, and clients converge anyway because they
 * re-read over REST on reconnect.
 */
export async function emitQueueUpdated(
  serviceId: string,
  action: QueueAction,
  ticketId: string | null = null
): Promise<void> {
  if (!io) return;

  try {
    const status = await queueService.getQueueStatus(serviceId);
    const seq = (sequences.get(serviceId) ?? 0) + 1;
    sequences.set(serviceId, seq);

    io.to(queueRoom(serviceId)).emit('QUEUE_UPDATED', {
      serviceId: status.serviceId,
      status: status.status,
      currentlyServing: status.currentlyServing,
      totalWaiting: status.totalWaiting,
      totalServedToday: status.totalServedToday,
      seq,
      action,
      ticketId,
    });
  } catch (error) {
    console.error('Failed to broadcast queue update:', error);
  }
}
