import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types'

/** A small toast (bottom-right) reflecting auto-update progress; offers Restart
 * when a new version is downloaded and ready to install. */
export function UpdateBanner(): JSX.Element | null {
  const [st, setSt] = useState<UpdateStatus | null>(null)
  useEffect(() => window.plex.updates.onStatus(setSt), [])

  if (!st || st.state === 'checking' || st.state === 'none' || st.state === 'error') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-surface-raised px-4 py-3 text-sm shadow-2xl">
      {st.state === 'ready' ? (
        <>
          <span className="text-ink">
            Update <span className="font-semibold">v{st.version}</span> ready
          </span>
          <button
            onClick={() => void window.plex.updates.install()}
            className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white transition hover:brightness-110"
          >
            Restart
          </button>
        </>
      ) : (
        <span className="text-ink-muted">
          {st.state === 'available'
            ? `Downloading update v${st.version}…`
            : `Downloading update… ${st.percent}%`}
        </span>
      )}
    </div>
  )
}
