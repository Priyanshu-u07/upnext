import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../socket/events'

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline'

interface SocketContextValue {
  socket: TypedSocket | null
  connection: ConnectionState
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connection: 'connecting',
})

/**
 * One connection for the whole app.
 *
 * Two things are deliberate here:
 *
 * The socket instance goes in state, but it is created once and never replaced,
 * so this provider re-renders its children exactly twice — once when the socket
 * exists and once per connection-state change. The fast-moving queue data is
 * NOT in this context. Putting it here would re-render every consumer on every
 * event, including screens that do not show it.
 *
 * Reconnection is Socket.IO's, not ours: it retries with exponential backoff
 * and jitter, so a clinic's worth of phones coming back after a wifi blip do
 * not all reconnect in the same millisecond.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  useEffect(() => {
    // No URL: connect to the page's own origin. Vite proxies /socket.io to the
    // backend, so there is no API host compiled into the bundle.
    const instance: TypedSocket = io({
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    })

    instance.on('connect', () => setConnection('connected'))
    instance.on('disconnect', () => setConnection('reconnecting'))
    instance.io.on('reconnect_attempt', () => setConnection('reconnecting'))
    instance.io.on('error', () => setConnection('offline'))

    setSocket(instance)

    return () => {
      // Without this, StrictMode's double mount in development leaves an
      // orphaned connection behind and every event arrives twice.
      instance.removeAllListeners()
      instance.close()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, connection }}>{children}</SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
