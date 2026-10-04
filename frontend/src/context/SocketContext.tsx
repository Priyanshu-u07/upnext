import { useEffect, useState, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { SocketContext, type ConnectionState, type TypedSocket } from '../hooks/useSocket'

/**
 * One connection for the whole app.
 *
 * The socket goes in state but is created once and never replaced. Queue data
 * deliberately does not live here — in context it would re-render every
 * consumer on every event, including screens that do not show it.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  useEffect(() => {
    // No URL: the page's own origin. Vite proxies /socket.io to the backend.
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
      // Without this, StrictMode's double mount orphans a connection and every
      // event arrives twice.
      instance.removeAllListeners()
      instance.close()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, connection }}>{children}</SocketContext.Provider>
  )
}
