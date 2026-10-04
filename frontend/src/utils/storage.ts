/**
 * Remembers which ticket this device holds, so a closed tab or a sleeping phone
 * does not lose someone's place — which would recreate the exact problem this
 * project exists to solve.
 *
 * Every call is wrapped: localStorage throws in private mode and when site data
 * is blocked, and that should forget the ticket rather than crash.
 */
const TICKET_KEY = 'queue.ticketId'

export function getStoredTicketId(): string | null {
  try {
    return localStorage.getItem(TICKET_KEY)
  } catch {
    return null
  }
}

export function storeTicketId(ticketId: string): void {
  try {
    localStorage.setItem(TICKET_KEY, ticketId)
  } catch {
    // Non-fatal: the ticket still works for as long as the page stays open.
  }
}

export function clearStoredTicketId(): void {
  try {
    localStorage.removeItem(TICKET_KEY)
  } catch {
    // Non-fatal.
  }
}

/** Typed once per machine, so the key is never compiled into the bundle. */
const STAFF_KEY = 'queue.staffKey'

export function getStaffKey(): string | null {
  try {
    return localStorage.getItem(STAFF_KEY)
  } catch {
    return null
  }
}

export function storeStaffKey(key: string): void {
  try {
    localStorage.setItem(STAFF_KEY, key)
  } catch {
    // Non-fatal: the dashboard will ask again next time.
  }
}

export function clearStaffKey(): void {
  try {
    localStorage.removeItem(STAFF_KEY)
  } catch {
    // Non-fatal.
  }
}
