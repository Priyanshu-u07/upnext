import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConnectionStatus from '../components/ConnectionStatus'
import { useQueue } from '../hooks/useQueue'
import { cancelTicket, getTicket } from '../services/api'
import { movesExistingPositions } from '../socket/events'
import type { Ticket } from '../types'
import { clearStoredTicketId } from '../utils/storage'

/**
 * What the patient watches while they wait. This is the primary surface of the
 * whole project — everything else exists so this screen can be accurate.
 */

interface Headline {
  title: string
  detail: string
  /** Loud when the patient must act now. */
  tone: 'urgent' | 'soon' | 'calm' | 'done'
}

/**
 * Turns a ticket into the one sentence the patient actually needs.
 *
 * The wait is "be back in {min}", not the full range: the errors are not
 * symmetric. Quote the high end and someone returns to find they were called
 * and sent to the back; quote the low end and they wait a few extra minutes.
 */
function headlineFor(ticket: Ticket): Headline {
  switch (ticket.status) {
    case 'CALLED':
      return { title: 'It is your turn', detail: 'Go to the counter now.', tone: 'urgent' }
    case 'SERVING':
      return { title: 'You are being seen', detail: '', tone: 'calm' }
    case 'SKIPPED':
      return {
        title: 'You missed your call',
        detail: 'Show this to the receptionist. They can call you back in.',
        tone: 'urgent',
      }
    case 'COMPLETED':
      return { title: 'All done', detail: 'Thank you.', tone: 'done' }
    case 'CANCELLED':
      return { title: 'Ticket cancelled', detail: '', tone: 'done' }
    case 'EXPIRED':
      return { title: 'Ticket expired', detail: '', tone: 'done' }
    case 'WAITING': {
      const ahead = ticket.position ?? 0
      if (ahead === 0) {
        return { title: 'You are next', detail: 'Stay nearby.', tone: 'urgent' }
      }
      if (ahead <= 2) {
        return {
          title: `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`,
          detail: 'Almost your turn. Head back now.',
          tone: 'soon',
        }
      }
      const beBackIn = ticket.estimatedWait?.min
      return {
        title: `${ahead} people ahead of you`,
        detail:
          beBackIn === undefined
            ? 'You can step out. Check this page before you return.'
            : `You can step out. Be back in about ${beBackIn} minutes.`,
        tone: 'calm',
      }
    }
  }
}

const TONE_CLASSES: Record<Headline['tone'], string> = {
  urgent: 'bg-emerald-600 text-white',
  soon: 'bg-amber-100 text-amber-900',
  calm: 'bg-white text-slate-900 border border-slate-200',
  done: 'bg-slate-100 text-slate-500',
}

export default function TicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refreshTicket = useCallback(async () => {
    if (!ticketId) return
    try {
      setTicket(await getTicket(ticketId))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void refreshTicket()
  }, [refreshTicket])

  // The service is only known once the ticket has loaded, so the subscription
  // starts after the first read rather than on mount.
  const { queue, lastEvent, connection } = useQueue(ticket?.serviceId ?? null)

  // A broadcast cannot carry this patient's position, so refetch the ticket
  // when the queue moves — but not on JOINED, or a hundred phones would
  // refetch on every arrival.
  useEffect(() => {
    if (!lastEvent) return
    if (!movesExistingPositions(lastEvent.action)) return
    void refreshTicket()
  }, [lastEvent, refreshTicket])

  useEffect(() => {
    if (connection === 'connected') void refreshTicket()
  }, [connection, refreshTicket])

  async function handleCancel() {
    if (!ticket) return
    if (!confirm('Give up your place in the queue?')) return
    try {
      await cancelTicket(ticket.id)
      clearStoredTicketId()
      navigate('/')
    } catch {
      void refreshTicket()
    }
  }

  function handleDone() {
    clearStoredTicketId()
    navigate('/')
  }

  if (loading) {
    return <Centered>Loading your ticket…</Centered>
  }

  if (!ticket) {
    return (
      <Centered>
        <p className="text-slate-900">We could not find that ticket.</p>
        <p className="mt-1 text-sm text-slate-500">{loadError?.message}</p>
        <button onClick={handleDone} className="mt-6 text-sm font-medium underline">
          Start again
        </button>
      </Centered>
    )
  }

  const headline = headlineFor(ticket)
  const finished =
    ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-10">
      <p className="text-sm text-slate-500">{ticket.serviceName}</p>

      <p className="mt-6 text-sm font-medium tracking-wide text-slate-400 uppercase">Your token</p>
      <p className="text-7xl font-bold tracking-tight tabular-nums text-slate-900">
        {ticket.tokenDisplay}
      </p>

      <div className={`mt-8 rounded-2xl px-5 py-6 ${TONE_CLASSES[headline.tone]}`}>
        <p className="text-xl font-semibold">{headline.title}</p>
        {headline.detail && <p className="mt-1 opacity-90">{headline.detail}</p>}
      </div>

      {queue && (
        <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
          <Stat label="Now serving" value={queue.currentlyServing?.tokenDisplay ?? '—'} />
          <Stat label="Waiting" value={String(queue.totalWaiting)} />
        </dl>
      )}

      <div className="mt-6">
        <ConnectionStatus connection={connection} />
      </div>

      <div className="mt-auto pt-10">
        {finished ? (
          <button
            onClick={handleDone}
            className="w-full rounded-xl bg-slate-900 px-5 py-4 font-medium text-white"
          >
            Done
          </button>
        ) : (
          <button
            onClick={() => void handleCancel()}
            className="w-full rounded-xl border border-slate-200 px-5 py-4 text-slate-600"
          >
            Cancel my ticket
          </button>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <dt className="text-xs tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      {children}
    </main>
  )
}
