import { useEffect, useState } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import { useQueue } from '../hooks/useQueue'
import { getServices } from '../services/api'
import type { Service } from '../types'

/**
 * The screen on the wall.
 *
 * It shows a token, never a name. In the clinic the receptionist calls your
 * name across a full waiting room, which tells everyone present who you are and
 * which doctor you are here to see. "A-07" tells them nothing.
 *
 * It is also the only surface for someone without a smartphone, so it has to be
 * readable from the back of the room: one number, as large as the screen
 * allows, and nothing competing with it.
 *
 * This screen is the clearest illustration of what the socket bought. It needs
 * only the state every viewer shares, which the event payload already carries,
 * so after the first REST read it makes no further requests at all — it used to
 * poll every three seconds, forever, to show a number that changes a few times
 * an hour.
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
      <p className="text-2xl tracking-[0.3em] text-slate-500 uppercase">Now serving</p>

      <p className="mt-4 text-[22vw] leading-none font-bold tracking-tight tabular-nums">
        {queue?.currentlyServing?.tokenDisplay ?? '—'}
      </p>

      <p className="mt-10 text-3xl text-slate-400">
        {queue ? `${queue.totalWaiting} waiting` : ' '}
      </p>

      <div className="absolute bottom-8 flex flex-col items-center gap-3">
        <ConnectionStatus connection={connection} dark />
        <p className="text-lg text-slate-600">{queue?.serviceName ?? ''}</p>
      </div>
    </main>
  )
}
