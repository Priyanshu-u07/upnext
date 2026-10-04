import type { NowServing, QueueStatus } from '../types'

/**
 * Mirrors backend/src/socket/events.ts. Duplicated rather than shared: a
 * workspace for two small apps costs more than it saves.
 */

export type QueueAction =
  | 'JOINED'
  | 'CALLED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'RECALLED'
  | 'CANCELLED'

export interface QueueUpdatedPayload {
  serviceId: string
  status: QueueStatus
  currentlyServing: NowServing | null
  totalWaiting: number
  totalServedToday: number
  /** Increments per service. Anything not newer than what we hold is dropped. */
  seq: number
  action: QueueAction
  ticketId: string | null
}

export interface ServerToClientEvents {
  QUEUE_UPDATED: (payload: QueueUpdatedPayload) => void
}

export interface ClientToServerEvents {
  'queue:subscribe': (serviceId: string) => void
  'queue:unsubscribe': (serviceId: string) => void
}

/**
 * Whether a change can have moved someone already in the queue.
 *
 * Joining behind you does not affect your position. At a hundred connected
 * phones, refetching on every event would turn one button press into a hundred
 * simultaneous requests.
 */
export function movesExistingPositions(action: QueueAction): boolean {
  return action !== 'JOINED'
}
