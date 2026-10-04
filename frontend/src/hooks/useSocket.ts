import { createContext, useContext } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../socket/events'

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface SocketContextValue {
  socket: TypedSocket | null
  connection: ConnectionState
}

/**
 * The context lives here rather than beside the provider so that
 * SocketContext.tsx exports a component and nothing else, which is what React
 * Fast Refresh needs to reload it without losing state.
 */
export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connection: 'connecting',
})

export function useSocket() {
  return useContext(SocketContext)
}
