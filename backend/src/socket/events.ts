import type { QueueStatusResponse } from '../types/index.js';

/** What caused the queue to change. Clients use it to decide what to refetch. */
export type QueueAction =
  | 'JOINED'
  | 'CALLED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'RECALLED'
  | 'CANCELLED';

/**
 * One event for every change, not TICKET_CALLED / TICKET_SKIPPED / etc. Any
 * event type a client forgets to handle becomes a screen that silently goes
 * stale.
 *
 * Carries only state identical for every viewer, so the wall display updates
 * without making a request. A patient's own position differs per viewer, so
 * phones refetch their own ticket instead.
 */
export interface QueueUpdatedPayload
  extends Pick<
    QueueStatusResponse,
    'serviceId' | 'status' | 'currentlyServing' | 'totalWaiting' | 'totalServedToday'
  > {
  /** Per-service counter. Clients drop anything not newer than what they hold. */
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

/** Per service, so calling at the lab does not wake phones waiting for the doctor. */
export const queueRoom = (serviceId: string) => `queue:${serviceId}`;
