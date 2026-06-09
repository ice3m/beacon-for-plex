import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PlexMediaItem } from '@shared/types'
import { keys, usePlaylists } from '../lib/hooks'

/** Map an item type to the playlist kind Plex expects. */
function playlistType(itemType: string): 'audio' | 'video' | 'photo' {
  if (['track', 'album', 'artist'].includes(itemType)) return 'audio'
  if (itemType === 'photo') return 'photo'
  return 'video'
}

interface Props {
  serverId: string
  item: PlexMediaItem
}

/** "Add to playlist" split button: pick an existing playlist or create one. */
export function AddToPlaylist({ serverId, item }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const qc = useQueryClient()
  const { data: playlists } = usePlaylists(serverId)

  const add = useMutation({
    mutationFn: (ratingKey: string) =>
      window.plex.playlists.addItems(serverId, ratingKey, [item.ratingKey]),
    onSuccess: (_d, ratingKey) => {
      qc.invalidateQueries({ queryKey: keys.playlistItems(serverId, ratingKey) })
      flashDone()
    }
  })

  const create = useMutation({
    mutationFn: () =>
      window.plex.playlists.create(serverId, name.trim(), playlistType(item.type), [
        item.ratingKey
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.playlists(serverId) })
      setCreating(false)
      setName('')
      flashDone()
    }
  })

  function flashDone(): void {
    setDone('Added ✓')
    setOpen(false)
    setTimeout(() => setDone(null), 2000)
  }

  // Only offer playlists whose kind matches this item.
  const kind = playlistType(item.type)
  const compatible = playlists?.filter((p) => p.playlistType === kind) ?? []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/10"
      >
        {done ?? '＋ Playlist'}
      </button>

      {open && (
        <>
          {/* Click-catcher to close the dropdown when clicking outside it. */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => {
              setOpen(false)
              setCreating(false)
            }}
          />
          <div className="absolute z-30 mt-2 w-64 rounded-xl border border-white/10 bg-surface-raised p-2 shadow-2xl">
          {creating ? (
            <div className="flex gap-2 p-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playlist name"
                className="flex-1 rounded-md border border-white/10 bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate()}
              />
              <button
                onClick={() => name.trim() && create.mutate()}
                disabled={create.isPending}
                className="rounded-md bg-accent px-3 text-sm text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setCreating(true)}
                className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-accent transition hover:bg-white/5"
              >
                ＋ New playlist…
              </button>
              <div className="max-h-60 overflow-y-auto">
                {compatible.length === 0 && (
                  <p className="px-3 py-2 text-xs text-ink-muted">No matching playlists yet.</p>
                )}
                {compatible.map((p) => (
                  <button
                    key={p.ratingKey}
                    onClick={() => add.mutate(p.ratingKey)}
                    disabled={add.isPending}
                    className="w-full truncate rounded-md px-3 py-2 text-left text-sm text-ink transition hover:bg-white/5"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </>
      )}
    </div>
  )
}
