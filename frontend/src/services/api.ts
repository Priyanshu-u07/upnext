import { getStaffKey } from '../utils/storage'
import type {
  Organization,
  QueueStatusView,
  Service,
  StaffQueueView,
  Ticket,
} from '../types'

/**
 * Typed client for the backend REST API.
 *
 * The socket says something changed; this is how a client learns what is
 * actually true, on first load and after every reconnect.
 *
 * Paths are relative — Vite proxies /api to :3001, so no API host is compiled
 * into the bundle.
 */

/** An error the server described: {error: {code, message}}. */
export class ApiError extends Error {
  // Fields rather than constructor parameter properties: Vite's
  // `erasableSyntaxOnly` only allows TypeScript that vanishes at build time.
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface ApiSuccess<T> {
  data: T
}

interface ApiFailure {
  error: { code: string; message: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    // fetch only rejects when the request never completed. An HTTP error
    // status is a resolved promise.
    throw new ApiError('Cannot reach the server', 'NETWORK_ERROR', 0)
  }

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const failure = body as ApiFailure | null
    throw new ApiError(
      failure?.error?.message ?? `Request failed (${res.status})`,
      failure?.error?.code ?? 'UNKNOWN',
      res.status,
    )
  }

  return (body as ApiSuccess<T>).data
}

// ─── Customer ───────────────────────────────────────────────

export const getOrganization = () => request<Organization>('/organization')

export const getServices = () => request<Service[]>('/services')

export const joinQueue = (serviceId: string) =>
  request<Ticket>(`/queues/${serviceId}/join`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

export const getQueueStatus = (serviceId: string) =>
  request<QueueStatusView>(`/queues/${serviceId}/status`)

export const getTicket = (ticketId: string) => request<Ticket>(`/tickets/${ticketId}`)

export const cancelTicket = (ticketId: string) =>
  request<Ticket>(`/tickets/${ticketId}/cancel`, { method: 'POST' })

// ─── Staff ──────────────────────────────────────────────────

/**
 * Staff calls carry the shared key as a header. A missing key gives the same
 * 401 as a wrong one, which the dashboard turns into a prompt.
 */
const staffRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, {
    ...init,
    headers: { 'x-staff-key': getStaffKey() ?? '' },
  })


export const getStaffQueue = (serviceId: string) =>
  staffRequest<StaffQueueView>(`/staff/queues/${serviceId}`)

export const callNext = (serviceId: string) =>
  staffRequest<Ticket>(`/staff/queues/${serviceId}/call-next`, { method: 'POST' })

export const completeTicket = (ticketId: string) =>
  staffRequest<Ticket>(`/staff/tickets/${ticketId}/complete`, { method: 'POST' })

export const skipTicket = (ticketId: string) =>
  staffRequest<Ticket>(`/staff/tickets/${ticketId}/skip`, { method: 'POST' })

export const recallTicket = (ticketId: string) =>
  staffRequest<Ticket>(`/staff/tickets/${ticketId}/recall`, { method: 'POST' })
