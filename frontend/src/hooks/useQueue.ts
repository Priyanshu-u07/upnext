import { useCallback, useEffect, useRef, useState } from 'react'
import { useSocket, type ConnectionState } from './useSocket'
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
 * The socket is a hint, not the source of truth: it says something changed,
 * REST says what is true. So this reads over REST on mount and after every
 * reconnect, and treats events as updates on state it already trusts.
 * Otherwise a phone that lost signal reconnects and shows a ten-minute-old
 * queue with no error and no spinner — confidently wrong.
 *
 * Two ordering guards: events older than the last applied `seq` are dropped,
 * and a REST read that started before the last event is discarded so a slow
 * read cannot overwrite a fresher event.
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

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Re-read after every reconnect: this is what stops a reconnected client
  // showing a queue it missed the updates for.
  useEffect(() => {
    if (connection === 'connected') void refresh()
  }, [connection, refresh])

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
      // This exact handler, not removeAllListeners: the socket is shared.
      socket.off('QUEUE_UPDATED', onUpdate)
    }
  }, [socket, serviceId])

  return { queue, lastEvent, connection, error, refresh: () => void refresh() }
}
