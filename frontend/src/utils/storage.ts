/**
 * Remembers which ticket this device holds.
 *
 * A patient closes the tab, or their phone sleeps and the browser discards the
 * page. Losing the token at that point would recreate the exact problem this
 * project exists to solve, so the id outlives the page.
 *
 * Every call is wrapped: localStorage throws in private mode and when site
 * data is blocked. A patient with cookies disabled should see a working page
 * that forgets their ticket, not a crash.
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

/**
 * The reception desk's shared key.
 *
 * Kept here rather than compiled into the bundle, so it is not readable by any
 * patient who opens devtools. Staff type it once per machine.
 */
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
