import { QRCodeSVG } from 'qrcode.react'

/**
 * The way into the queue, on the screen everyone in the room can already see.
 *
 * It goes here rather than on a printed card at the desk for three reasons: the
 * screen is already on the wall, so there is nothing to print or replace; it
 * answers the first question anyone walking in has; and a printed code cannot go
 * stale on a wall after the address changes, because this one is generated from
 * the page's own origin every time it renders.
 *
 * Drawn on white even though the display is near-black. Scanners rely on the
 * contrast between dark modules and a light background, and an inverted code is
 * unreliable on a lot of phone cameras — this one has to work first time, from
 * across a waiting room, for someone who has never used it.
 */
export default function JoinQrCode({ size = 132 }: { size?: number }) {
  // Whatever host is serving this screen is the host a patient should reach.
  const joinUrl = typeof window === 'undefined' ? '' : window.location.origin

  if (!joinUrl) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          // Medium recovery: a code on a wall collects glare and fingerprints,
          // and this survives roughly 15% of it being unreadable.
          level="M"
          marginSize={0}
        />
      </div>
      <p className="text-sm tracking-wide text-slate-400">Scan to join the queue</p>
    </div>
  )
}
