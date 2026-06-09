import { useEffect, useState } from 'react'

/**
 * One-time "What's New" dialog shown on the first launch after an update.
 * Pulls itemized notes from the main process (which returns them only once per
 * upgrade), so this renders nothing on normal launches.
 */
export function WhatsNew(): JSX.Element | null {
  const [notes, setNotes] = useState<{ version: string; items: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    window.plex.updates
      .whatsNew()
      .then((n) => {
        if (!cancelled) setNotes(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!notes) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setNotes(null)}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Updated</p>
          <h2 className="mt-0.5 text-xl font-bold text-ink">What's New in v{notes.version}</h2>
        </div>

        <ul className="max-h-[50vh] space-y-3 overflow-y-auto px-6 py-5">
          {notes.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink">
              <span className="mt-0.5 shrink-0 text-accent">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end border-t border-white/10 px-6 py-4">
          <button
            onClick={() => setNotes(null)}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
