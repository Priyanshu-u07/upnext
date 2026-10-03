import { useCallback, useEffect, useRef, useState } from 'react'
import { useSocket, type ConnectionState } from '../context/SocketContext'
import { getQueueStatus } from '../services/api'
import type { QueueUpdatedPayload } from '../socket/events'
import type { QueueStatusView } from '../types'

export interface QueueState {
  queue: QueueStatusView | null
  /** The most recent change. Screens use it to decide what else to refetch. */
  lastEvent: QueueUpdatedPayload | null
  connection: ConnectionState
  error: Error | null
  /** Re-read the truth over REST. */
  refresh: () => void
}

/**
 * Live view of one service's queue.
 *
 * The governing idea: **the socket is a hint, not the source of truth.** It
 * says something changed. REST says what is actually true. So this hook reads
 * over REST when it mounts and again after every reconnect, and treats events
 * only as updates on top of a state it already trusts.
 *
 * Without that, a phone that loses signal during a call reconnects to a live
 * socket and sits there showing a queue from ten minutes ago — no error, no
 * spinner, just confidently wrong. That is worse than no real-time at all,
 * because the patient has no reason to doubt it.
 *
 * Two ordering guards, both of which the polling version also needed:
 *
 * - Events carry a per-service `seq`. Anything not newer than what we already
 *   applied is dropped, so a late delivery cannot walk the queue backwards.
 * - A REST read that started before the last applied event is discarded. A slow
 *   read must not overwrite a fresher event that arrived while it was in flight.
 */
export function useQueue(serviceId: string | null): QueueState {
  const { socket, connection } = useSocket()

  const [queue, setQueue] = useState<QueueStatusView | null>(null)
  const [lastEvent, setLastEvent] = useState<QueueUpdatedPayload | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const appliedSeq = useRef(0)
  const lastEventAt = useRef(0)

  const refresh = useCallback(async () => {
    if (!serviceId) return
    const startedAt = Date.now()
    try {
      const status = await getQueueStatus(serviceId)
      // An event landed while this was in flight; it is newer than this read.
      if (lastEventAt.current > startedAt) return
      appliedSeq.current = 0
      setQueue(status)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [serviceId])

  // Truth on mount and whenever the service changes.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Truth again after every reconnect. This is the line that stops a
  // reconnected client showing a queue it missed the updates for.
  useEffect(() => {
    if (connection === 'connected') void refresh()
  }, [connection, refresh])

  // Join this service's room, and leave it when the screen changes service.
  useEffect(() => {
    if (!socket || !serviceId) return
    socket.emit('queue:subscribe', serviceId)
    return () => {
      socket.emit('queue:unsubscribe', serviceId)
    }
  }, [socket, serviceId])

  useEffect(() => {
    if (!socket || !serviceId) return

    const onUpdate = (payload: QueueUpdatedPayload) => {
      if (payload.serviceId !== serviceId) return
      if (payload.seq <= appliedSeq.current) return

      appliedSeq.current = payload.seq
      lastEventAt.current = Date.now()

      setQueue((current) =>
        current === null
          ? current
          : {
              ...current,
              status: payload.status,
              currentlyServing: payload.currentlyServing,
              totalWaiting: payload.totalWaiting,
              totalServedToday: payload.totalServedToday,
            },
      )
      setLastEvent(payload)
    }

    socket.on('QUEUE_UPDATED', onUpdate)
    return () => {
      // Removing this exact handler, not all of them: other screens may be
      // listening on the same shared socket. Without the cleanup, StrictMode's
      // double mount alone would apply every event twice.
      socket.off('QUEUE_UPDATED', onUpdate)
    }
  }, [socket, serviceId])

  return { queue, lastEvent, connection, error, refresh: () => void refresh() }
}
