/**
 * Mirrors the backend's API response types (backend/src/types/index.ts).
 *
 * These are duplicated rather than shared. A shared package would guarantee
 * they never drift, but it means a workspace and a build step for two small
 * apps. The trade is accepted deliberately: if the backend contract changes,
 * this file must change with it.
 *
 * One difference on purpose: the backend types `status` as `string`. Here the
 * statuses are unions, so a `switch` over them can be checked for
 * exhaustiveness and an unhandled case is a compile error, not a blank badge.
 */

export type TicketStatus =
  | 'WAITING'
  | 'CALLED'
  | 'SERVING'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'EXPIRED'

export type QueueStatus = 'OPEN' | 'CLOSED' | 'PAUSED'

export type Priority = 'NORMAL' | 'PRIORITY'

export interface Service {
  id: string
  name: string
  prefix: string
  averageServiceTime: number
}

export interface EstimatedWait {
  /** Minutes. This is the number that matters — it means "be back by". */
  min: number
  max: number
}

export interface Ticket {
  id: string
  serviceId: string
  serviceName: string
  tokenNumber: number
  /** Derived server-side from service prefix + padded number, e.g. "A-07". */
  tokenDisplay: string
  status: TicketStatus
  priority: Priority
  /** People ahead. 0 means you are next. null once you are no longer waiting. */
  position: number | null
  estimatedWait: EstimatedWait | null
  createdAt: string
  calledAt: string | null
  completedAt: string | null
}

export interface NowServing {
  tokenNumber: number
  tokenDisplay: string
}

export interface QueueStatusView {
  serviceId: string
  serviceName: string
  queueId: string
  status: QueueStatus
  currentlyServing: NowServing | null
  totalWaiting: number
  totalServedToday: number
}

export interface StaffQueueView {
  serviceId: string
  serviceName: string
  queueId: string
  status: QueueStatus
  currentlyServing: Ticket | null
  tickets: Ticket[]
  totalWaiting: number
  totalServedToday: number
}
