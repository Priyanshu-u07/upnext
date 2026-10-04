import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectionStatus from '../components/ConnectionStatus'
import { useQueue } from '../hooks/useQueue'
import { ApiError, getOrganization, getServices, joinQueue } from '../services/api'
import type { Organization, Service } from '../types'
import { getStoredTicketId, storeTicketId } from '../utils/storage'

/**
 * Where a patient lands after scanning the code on the wall display.
 *
 * If this device already holds a ticket we go straight to it rather than
 * offering to join again — joining twice is the mistake the page should make
 * impossible, not merely reject.
 */
export default function JoinPage() {
  const navigate = useNavigate()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [services, setServices] = useState<Service[] | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = getStoredTicketId()
    if (existing) {
      navigate(`/ticket/${existing}`, { replace: true })
      return
    }
    getOrganization().then(setOrganization).catch(() => {})
    getServices()
      .then(setServices)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [navigate])

  async function handleJoin(serviceId: string) {
    setJoining(serviceId)
    setError(null)
    try {
      const ticket = await joinQueue(serviceId)
      storeTicketId(ticket.id)
      navigate(`/ticket/${ticket.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join the queue')
      setJoining(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Dark chrome, light content: a family resemblance to the wall display,
          and it stops the header reading as an empty band on a desktop. */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-md px-5 py-5">
          <h1 className="truncate text-lg leading-tight font-semibold">
            {organization?.name ?? ' '}
          </h1>
          <p className="text-sm text-slate-400">Take a token</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-3">
          {services === null && !error && (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          )}

          {services?.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              busy={joining !== null}
              joining={joining === service.id}
              onJoin={() => void handleJoin(service.id)}
            />
          ))}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-500">
          You will get a token number. You can leave and come back. Your phone keeps your
          place and shows when to return.
        </p>
      </main>
    </div>
  )
}

/**
 * One queueable service, with how busy it is right now.
 *
 * A component rather than markup in a loop because each card runs its own
 * `useQueue` and subscribes to that service's room, so the numbers move on
 * their own. They also answer the question the page previously asked blind:
 * 40 people waiting here and 2 there changes what a patient does.
 */
function ServiceCard({
  service,
  busy,
  joining,
  onJoin,
}: {
  service: Service
  busy: boolean
  joining: boolean
  onJoin: () => void
}) {
  const { queue, connection } = useQueue(service.id)

  const waiting = queue?.totalWaiting
  const isOpen = queue?.status !== 'CLOSED' && queue?.status !== 'PAUSED'

  // Leaning early, as the ticket screen does: back too early costs a few
  // minutes, back too late costs your place.
  const roughWait =
    waiting === undefined ? undefined : Math.round(waiting * service.averageServiceTime * 0.7)

  return (
    // A div, not a button: <button> may only contain phrasing content, and
    // nesting blocks confuses screen readers about what is clickable.
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{service.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            about {service.averageServiceTime} min each
          </p>
        </div>
        <button
          onClick={onJoin}
          disabled={busy || !isOpen}
          className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {joining ? 'Joining…' : isOpen ? 'Join' : 'Closed'}
        </button>
      </div>

      <dl className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-xs tracking-wide text-slate-400 uppercase">Waiting</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{waiting ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-400 uppercase">Now serving</dt>
          <dd className="text-lg font-semibold tabular-nums text-emerald-600">
            {queue?.currentlyServing?.tokenDisplay ?? '—'}
          </dd>
        </div>
        {roughWait !== undefined && roughWait > 0 && (
          <div>
            <dt className="text-xs tracking-wide text-slate-400 uppercase">Your wait</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">~{roughWait} min</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 empty:hidden">
        <ConnectionStatus connection={connection} />
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
      <div className="h-5 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-28 rounded bg-slate-100" />
      <div className="mt-4 h-10 rounded bg-slate-50" />
    </div>
  )
}
