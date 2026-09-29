import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, getServices, joinQueue } from '../services/api'
import type { Service } from '../types'
import { getStoredTicketId, storeTicketId } from '../utils/storage'

/**
 * Where a patient lands after scanning the QR code at the desk.
 *
 * If this device already holds a ticket we go straight to it rather than
 * offering to join again — joining twice is the mistake the page should make
 * impossible, not merely reject.
 */
export default function JoinPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[] | null>(null)
  const [joining, setJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = getStoredTicketId()
    if (existing) {
      navigate(`/ticket/${existing}`, { replace: true })
      return
    }
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">City Health Clinic</h1>
      <p className="mt-1 text-slate-500">Choose what you are here for.</p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 space-y-3">
        {services === null && !error && <p className="text-slate-400">Loading…</p>}

        {services?.map((service) => (
          <button
            key={service.id}
            onClick={() => void handleJoin(service.id)}
            disabled={joining !== null}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-slate-900 disabled:opacity-50"
          >
            <span>
              <span className="block font-medium text-slate-900">{service.name}</span>
              <span className="block text-sm text-slate-500">
                about {service.averageServiceTime} min each
              </span>
            </span>
            <span className="text-sm font-medium text-slate-900">
              {joining === service.id ? 'Joining…' : 'Join'}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-10 text-sm text-slate-400">
        You will get a token number. You can leave and come back — your phone will show your
        position.
      </p>
    </main>
  )
}
