import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PlexHomeUser } from '@shared/types'
import { keys, useHomeUsers } from '../lib/hooks'

interface Props {
  serverId: string
  ratingKey: string
  title: string
  onClose: () => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sharing' }
  | { kind: 'done'; user: string }
  | { kind: 'error'; message: string }

/**
 * Copies a playlist into a chosen Plex Home user's account so only that user
 * sees it. Prompts for a PIN if the user is profile-protected.
 */
export function ShareToUserModal({ serverId, ratingKey, title, onClose }: Props): JSX.Element {
  const { data: users, isLoading, isError } = useHomeUsers()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pinFor, setPinFor] = useState<PlexHomeUser | null>(null)
  const [pin, setPin] = useState('')
  const [keepInSync, setKeepInSync] = useState(true)
  const qc = useQueryClient()

  const share = async (user: PlexHomeUser, withPin?: string): Promise<void> => {
    setStatus({ kind: 'sharing' })
    try {
      const res = await window.plex.playlists.shareToUser(
        serverId,
        ratingKey,
        user.uuid,
        withPin,
        keepInSync
      )
      if (res.ok) {
        setStatus({ kind: 'done', user: user.title })
        setPinFor(null)
        setPin('')
        if (keepInSync) qc.invalidateQueries({ queryKey: keys.syncedPlaylists(serverId) })
      } else if ((res.error ?? '').toLowerCase().includes('pin')) {
        setPinFor(user)
        setStatus({ kind: 'idle' })
      } else {
        setStatus({ kind: 'error', message: res.error ?? 'Share failed' })
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Share failed' })
    }
  }

  const candidates = (users ?? []).filter((u) => !u.admin)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Share “{title}”</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-muted">
          Copies this playlist into a Home user&apos;s account — only they will see it.
        </p>

        <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg bg-white/5 p-3">
          <input
            type="checkbox"
            checked={keepInSync}
            onChange={(e) => setKeepInSync(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="text-xs text-ink-muted">
            <span className="font-medium text-ink">Keep in two-way sync</span> — adds/removes by
            either of you stay matched (reconciles every few minutes).
          </span>
        </label>

        {isLoading && <p className="text-sm text-ink-muted">Loading users…</p>}
        {isError && <p className="text-sm text-red-400">Couldn&apos;t load Home users.</p>}
        {users && candidates.length === 0 && (
          <p className="text-sm text-ink-muted">
            No Home users found. This works with Plex Home (managed) users.
          </p>
        )}

        <div className="space-y-1">
          {candidates.map((u) => (
            <div key={u.uuid}>
              <button
                onClick={() => share(u)}
                disabled={status.kind === 'sharing'}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5 disabled:opacity-50"
              >
                {u.thumb ? (
                  <img src={u.thumb} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/70 text-sm">
                    {u.title[0]}
                  </span>
                )}
                <span className="flex-1 truncate text-sm">{u.title}</span>
                {u.protected && <span className="text-xs text-ink-muted">🔒</span>}
              </button>

              {pinFor?.uuid === u.uuid && (
                <div className="mb-2 ml-11 flex gap-2">
                  <input
                    autoFocus
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN"
                    type="password"
                    className="w-24 rounded-md border border-white/10 bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                    onKeyDown={(e) => e.key === 'Enter' && pin && share(u, pin)}
                  />
                  <button
                    onClick={() => pin && share(u, pin)}
                    className="rounded-md bg-accent px-3 text-sm text-white"
                  >
                    Unlock
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {status.kind === 'done' && (
          <p className="mt-4 text-sm text-emerald-400">Shared with {status.user} ✓</p>
        )}
        {status.kind === 'sharing' && (
          <p className="mt-4 text-sm text-ink-muted">Sharing…</p>
        )}
        {status.kind === 'error' && <p className="mt-4 text-sm text-red-400">{status.message}</p>}
      </div>
    </div>
  )
}
