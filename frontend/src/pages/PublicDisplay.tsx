import { useEffect, useState } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import JoinQrCode from '../components/JoinQrCode'
import { useQueue } from '../hooks/useQueue'
import { getServices } from '../services/api'
import type { Service } from '../types'

/**
 * The screen on the wall.
 *
 * A token, never a name: calling a name across a waiting room tells everyone
 * present who you are and which doctor you are seeing. It is also the only
 * surface for someone without a smartphone, so it has to read from the back of
 * the room.
 *
 * Everything it shows is in the event payload, so after the first REST read it
 * makes no further requests at all.
 */
export default function PublicDisplay() {
  const [service, setService] = useState<Service | null>(null)

  useEffect(() => {
    getServices()
      .then((list) => setService(list[0] ?? null))
      .catch(() => {})
  }, [])

  const { queue, connection } = useQueue(service?.id ?? null)

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Words, not a placeholder: a dash at this size is a white bar the
            width of the screen, which reads as broken rather than idle. */}
        {queue?.currentlyServing ? (
          <>
            <p className="text-2xl tracking-[0.3em] text-slate-500 uppercase">Now serving</p>
            <p className="mt-4 text-[20vw] leading-none font-bold tracking-tight tabular-nums">
              {queue.currentlyServing.tokenDisplay}
            </p>
          </>
        ) : (
          <p className="text-4xl text-slate-500">
            {queue ? 'Nobody is being called right now' : 'Connecting…'}
          </p>
        )}

        <p className="mt-8 text-3xl text-slate-400">
          {queue ? `${queue.totalWaiting} waiting` : ' '}
        </p>
      </div>

      {/* The code sits below the number: only someone who has just walked in
          needs it, and they will look for it. */}
      <footer className="flex items-end justify-between gap-6 px-10 pb-8">
        <div className="flex flex-col gap-3">
          <ConnectionStatus connection={connection} dark />
          <p className="text-xl text-slate-500">{queue?.serviceName ?? ''}</p>
        </div>

        <JoinQrCode />
      </footer>
    </main>
  )
}
