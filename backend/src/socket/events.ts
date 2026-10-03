import type { QueueStatusResponse } from '../types/index.js';

/**
 * The socket contract.
 *
 * Socket.IO is typed by two interfaces — what the server sends and what it
 * accepts — so a payload the client and server disagree about is a compile
 * error rather than an empty screen at runtime. On a project where one event
 * reaches three different screens, that is worth the setup.
 */

/** What caused the queue to change. Clients use it to decide what to refetch. */
export type QueueAction =
  | 'JOINED'
  | 'CALLED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'RECALLED'
  | 'CANCELLED';

/**
 * One event for every change, rather than TICKET_CALLED, TICKET_SKIPPED and so
 * on. Every screen wants the same thing — the current state of the queue — and
 * fine-grained events mean any type a client forgets to handle becomes a screen
 * that silently goes stale.
 *
 * The payload carries the state that is identical for every viewer, so the wall
 * display and the staff counters update without anyone making a request. It
 * cannot carry a patient's own position, because that differs per viewer: each
 * phone refetches its own ticket, and only when the action could have moved it.
 */
export interface QueueUpdatedPayload
  extends Pick<
    QueueStatusResponse,
    'serviceId' | 'status' | 'currentlyServing' | 'totalWaiting' | 'totalServedToday'
  > {
  /**
   * Increments per service. Socket.IO delivers in order on a healthy
   * connection, but a client that reconnects mid-stream can see an old event
   * after a fresh REST read, so clients drop anything not newer than what they
   * already have.
   */
  seq: number;
  action: QueueAction;
  /** The ticket this action was about, when there was one. */
  ticketId: string | null;
}

export interface ServerToClientEvents {
  QUEUE_UPDATED: (payload: QueueUpdatedPayload) => void;
}

export interface ClientToServerEvents {
  'queue:subscribe': (serviceId: string) => void;
  'queue:unsubscribe': (serviceId: string) => void;
}

/**
 * Clients are grouped per service, so calling the next patient at the lab does
 * not wake up every phone waiting for general consultation.
 */
export const queueRoom = (serviceId: string) => `queue:${serviceId}`;
