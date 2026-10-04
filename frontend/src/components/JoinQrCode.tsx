import { QRCodeSVG } from 'qrcode.react'

/**
 * The way into the queue, on the screen the whole room can already see.
 *
 * Generated from the page's own origin, so unlike a printed card it cannot go
 * stale when the address changes. Drawn on white despite the dark display:
 * scanners need dark modules on a light background.
 */
export default function JoinQrCode({ size = 132 }: { size?: number }) {
  const joinUrl = typeof window === 'undefined' ? '' : window.location.origin

  if (!joinUrl) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          // Survives ~15% damage: a wall code collects glare and fingerprints.
          level="M"
          marginSize={0}
        />
      </div>
      <p className="text-sm tracking-wide text-slate-400">Scan to join the queue</p>
    </div>
  )
}
