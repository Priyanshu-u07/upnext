import type { ConnectionState } from '../hooks/useSocket'

/**
 * Says whether what is on screen is live, and stays silent while it is.
 *
 * A position that has quietly stopped updating looks exactly like one that has
 * not changed, and someone deciding whether to step out needs the difference.
 */
const LABELS: Record<ConnectionState, string | null> = {
  connected: null,
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting — this may be out of date',
  offline: 'Offline — this may be out of date',
}

export default function ConnectionStatus({
  connection,
  dark,
}: {
  connection: ConnectionState
  dark?: boolean
}) {
  const label = LABELS[connection]
  if (!label) return null

  return (
    <p
      className={`rounded-lg px-4 py-2 text-sm ${
        dark ? 'bg-white/10 text-slate-300' : 'bg-amber-50 text-amber-800'
      }`}
      role="status"
    >
      {label}
    </p>
  )
}
