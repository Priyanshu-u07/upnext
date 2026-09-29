import { useCallback, useEffect, useRef, useState } from 'react'

export interface PollingState<T> {
  data: T | null
  /** Set when the most recent attempt failed. `data` keeps the last good value. */
  error: Error | null
  /** True only until the first response. Later polls do not re-trigger it. */
  loading: boolean
  /** Fetch now, without waiting for the next tick. */
  refresh: () => void
}

/**
 * Re-runs `fetcher` on an interval and exposes the latest result.
 *
 * This is Phase 2's stand-in for real-time updates, and it is deliberately the
 * naive approach so there is something to compare against in Phase 3.
 *
 * Three details matter, and all three come back in the socket version:
 *
 * 1. Out-of-order responses. Poll N+1 can land before poll N — a slow request
 *    followed by a fast one. Without a guard the screen shows older data than
 *    it already had, and it looks like the queue went backwards. Each request
 *    carries a sequence number and stale ones are dropped.
 *
 * 2. A failed poll must not blank the screen. If the network blips, the last
 *    known position is still far more useful than an empty page, so `data`
 *    survives and `error` is raised alongside it.
 *
 * 3. Cleanup. The interval and any in-flight response are ignored once the
 *    component unmounts, or React will warn about setting state on something
 *    that is gone. In dev, StrictMode mounts twice, so a missing cleanup shows
 *    up immediately as double polling.
 *
 * Known limitation: this keeps polling while the tab is hidden, which is
 * exactly wrong for a patient whose phone is in their pocket. Fixing it means
 * wiring up visibilitychange — one of several things a socket makes moot.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  // Held in a ref so changing the fetcher identity does not restart the
  // interval on every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const cancelled = useRef(false)
  const latestSeq = useRef(0)

  const run = useCallback(async () => {
    const seq = ++latestSeq.current
    try {
      const result = await fetcherRef.current()
      if (cancelled.current || seq !== latestSeq.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (cancelled.current || seq !== latestSeq.current) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!cancelled.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    cancelled.current = false
    void run()
    const id = setInterval(() => void run(), intervalMs)
    return () => {
      cancelled.current = true
      clearInterval(id)
    }
  }, [run, intervalMs, enabled])

  return { data, error, loading, refresh: run }
}
