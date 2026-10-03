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
 * Socket.IO lives here and nowhere else.
 *
 * queue.service.ts never imports this file. It returns results; controllers
 * call emitQueueUpdated afterwards. That keeps the business logic runnable
 * without a socket server — which matters in Phase 4, where the concurrency
 * tests hammer the service directly and should not need a listening port.
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
    // A client subscribes to the queues it is showing. The wall display and a
    // patient's phone watch one; nothing watches all of them.
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
 * Reads the queue state itself rather than taking it from the caller, so the
 * broadcast can never disagree with the database — even if the caller is
 * holding a response built a moment earlier.
 *
 * A failure here must not fail the HTTP request that triggered it. The write
 * has already committed; the customer has their ticket. A client that misses
 * the event still converges, because every screen reads the truth over REST
 * when it mounts and again whenever the socket reconnects.
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
