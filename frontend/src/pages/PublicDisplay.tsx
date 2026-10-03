import { useEffect, useState } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import JoinQrCode from '../components/JoinQrCode'
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
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/*
          An idle queue gets words, not a placeholder. Rendering a dash at this
          size turns it into a white bar the width of the screen, which reads as
          a broken display rather than an empty one — and the one thing a screen
          on a wall must never do is look broken.
        */}
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

      {/*
        The join code sits at the bottom, deliberately below the fold of
        attention. Someone already holding a token needs the number; only
        someone who has just walked in needs the code, and they will look for it.
      */}
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
