import { useCallback, useEffect, useState } from 'react'
import ConnectionStatus from '../components/ConnectionStatus'
import { useQueue } from '../hooks/useQueue'
import {
  ApiError,
  callNext,
  completeTicket,
  getServices,
  getStaffQueue,
  recallTicket,
  skipTicket,
} from '../services/api'
import type { Service, StaffQueueView, Ticket, TicketStatus } from '../types'
import { getStaffKey, storeStaffKey } from '../utils/storage'

/**
 * The receptionist's screen — what replaces the notebook.
 *
 * Built around one button, because that is the whole budget. Cost more
 * attention than writing a name and calling it out, and the notebook comes
 * back out.
 */

const STATUS_STYLES: Record<TicketStatus, string> = {
  WAITING: 'bg-slate-100 text-slate-600',
  CALLED: 'bg-emerald-600 text-white',
  SERVING: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-50 text-slate-400',
  SKIPPED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-slate-50 text-slate-400',
  EXPIRED: 'bg-slate-50 text-slate-400',
}

export default function StaffDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  // A fresh reception machine simply has not been given the key yet, so a 401
  // is a prompt rather than an error.
  const [needsKey, setNeedsKey] = useState(() => getStaffKey() === null)

  useEffect(() => {
    getServices()
      .then((list) => {
        setServices(list)
        setServiceId((current) => current ?? list[0]?.id ?? null)
      })
      .catch(() => setActionError('Could not load services'))
  }, [])

  const [queue, setQueue] = useState<StaffQueueView | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!serviceId) return
    try {
      setQueue(await getStaffQueue(serviceId))
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNeedsKey(true)
        return
      }
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [serviceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // The broadcast carries the counters but not the ticket list, so re-read it
  // on every change. Affordable here: one reception desk, not a hundred phones.
  const { lastEvent, connection } = useQueue(serviceId)

  useEffect(() => {
    if (lastEvent) void refresh()
  }, [lastEvent, refresh])

  useEffect(() => {
    if (connection === 'connected') void refresh()
  }, [connection, refresh])

  // Refresh directly rather than waiting for our own broadcast: pressing Call
  // Next should work even if the socket is unhealthy.
  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      void refresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNeedsKey(true)
      } else {
        setActionError(err instanceof Error ? err.message : 'Action failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const active = queue?.tickets.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')

  if (needsKey) {
    return (
      <StaffKeyPrompt
        onSubmit={(key) => {
          storeStaffKey(key)
          setNeedsKey(false)
          void refresh()
        }}
      />
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Reception</h1>
        <select
          value={serviceId ?? ''}
          onChange={(e) => setServiceId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="Now serving" value={queue?.currentlyServing?.tokenDisplay ?? '—'} />
        <Stat label="Waiting" value={queue ? String(queue.totalWaiting) : '—'} />
        <Stat label="Served today" value={queue ? String(queue.totalServedToday) : '—'} />
      </dl>

      <button
        onClick={() => void act(() => callNext(serviceId!))}
        disabled={busy || !queue || queue.totalWaiting === 0}
        className="mt-6 w-full rounded-2xl bg-slate-900 px-6 py-6 text-2xl font-semibold text-white disabled:opacity-40"
      >
        Call next
      </button>

      <div className="mt-4">
        <ConnectionStatus connection={connection} />
      </div>

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not read the queue. Showing the last known list.
        </p>
      )}

      <ul className="mt-8 divide-y divide-slate-100">
        {active?.length === 0 && (
          <li className="py-10 text-center text-slate-400">Nobody is waiting.</li>
        )}
        {active?.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            busy={busy}
            onComplete={() => void act(() => completeTicket(ticket.id))}
            onSkip={() => void act(() => skipTicket(ticket.id))}
            onRecall={() => void act(() => recallTicket(ticket.id))}
          />
        ))}
      </ul>
    </main>
  )
}

function TicketRow({
  ticket,
  busy,
  onComplete,
  onSkip,
  onRecall,
}: {
  ticket: Ticket
  busy: boolean
  onComplete: () => void
  onSkip: () => void
  onRecall: () => void
}) {
  const called = ticket.status === 'CALLED' || ticket.status === 'SERVING'

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-16 text-lg font-semibold tabular-nums text-slate-900">
          {ticket.tokenDisplay}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="flex gap-2">
        {called && (
          <Action onClick={onComplete} disabled={busy} label="Done" />
        )}
        {called && <Action onClick={onSkip} disabled={busy} label="Not here" />}
        {ticket.status === 'SKIPPED' && (
          <Action onClick={onRecall} disabled={busy} label="Call back" primary />
        )}
      </div>
    </li>
  )
}

function Action({
  onClick,
  disabled,
  label,
  primary,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
        primary ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'
      }`}
    >
      {label}
    </button>
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

/** Asked once per machine, so the key never appears in the bundle. */
function StaffKeyPrompt({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState('')

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-slate-900">Reception</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter the staff key to manage the queue. You only need to do this once on this
        computer.
      </p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Staff key"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
        >
          Continue
        </button>
      </form>
    </main>
  )
}
