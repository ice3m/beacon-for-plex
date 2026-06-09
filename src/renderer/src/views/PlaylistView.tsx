import { useMutation, useQueryClient } from '@tanstack/react-query'
import { imageUrl } from '@shared/ipc'
import { useState } from 'react'
import {
  keys,
  usePlaylistItems,
  useDeletePlaylist,
  useSyncedPlaylists,
  useSyncNow,
  useUnsync
} from '../lib/hooks'
import { formatDuration, itemSubtitle } from '../lib/format'
import { useNav } from '../state/nav'
import { Loading, ErrorState } from '../components/States'
import { ShareToUserModal } from '../components/ShareToUserModal'

interface Props {
  serverId: string
  ratingKey: string
  title: string
}

/** A single playlist's ordered items, with remove + delete actions. */
export function PlaylistView({ serverId, ratingKey, title }: Props): JSX.Element {
  const { data: items, isLoading, isError, error } = usePlaylistItems(serverId, ratingKey)
  const { navigate, back } = useNav()
  const qc = useQueryClient()
  const deletePlaylist = useDeletePlaylist(serverId)
  const [sharing, setSharing] = useState(false)

  const removeItem = useMutation({
    mutationFn: (playlistItemID: string) =>
      window.plex.playlists.removeItem(serverId, ratingKey, playlistItemID),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.playlistItems(serverId, ratingKey) })
  })

  if (isLoading) return <Loading label="Loading playlist…" />
  if (isError) return <ErrorState message={(error as Error)?.message ?? 'Failed to load'} />

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between px-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSharing(true)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink transition hover:bg-white/10"
          >
            Share with User
          </button>
          <button
            onClick={() => deletePlaylist.mutate(ratingKey, { onSuccess: () => back() })}
            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
          >
            Delete playlist
          </button>
        </div>
      </div>

      {sharing && (
        <ShareToUserModal
          serverId={serverId}
          ratingKey={ratingKey}
          title={title}
          onClose={() => setSharing(false)}
        />
      )}

      <SyncStatus serverId={serverId} ratingKey={ratingKey} />

      <div className="px-8">
        {items?.map((item, i) => {
          const src = imageUrl(serverId, item.thumb ?? item.grandparentThumb, {
            width: 160,
            height: 90
          })
          return (
            <div
              key={`${item.ratingKey}-${i}`}
              className="group flex items-center gap-4 rounded-lg px-3 py-2 transition hover:bg-white/5"
            >
              <span className="w-6 text-right text-sm text-ink-muted">{i + 1}</span>
              <button
                onClick={() => navigate({ name: 'detail', ratingKey: item.ratingKey })}
                className="flex flex-1 items-center gap-4 text-left"
              >
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-surface-raised">
                  {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-xs text-ink-muted">{itemSubtitle(item)}</p>
                </div>
              </button>
              <span className="text-xs text-ink-muted">{formatDuration(item.duration)}</span>
              {item.playlistItemID && (
                <button
                  onClick={() => removeItem.mutate(item.playlistItemID!)}
                  title="Remove from playlist"
                  aria-label="Remove from playlist"
                  className="rounded p-2 text-ink-muted opacity-0 transition hover:bg-white/10 hover:text-ink group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Two-way sync status + controls for a playlist that's shared with Home users. */
function SyncStatus({ serverId, ratingKey }: { serverId: string; ratingKey: string }): JSX.Element | null {
  const { data: synced } = useSyncedPlaylists(serverId)
  const syncNow = useSyncNow(serverId)
  const unsync = useUnsync(serverId)

  const group = synced?.find((g) => g.adminRatingKey === ratingKey)
  if (!group) return null

  const lastSynced = group.lastSyncedAt
    ? new Date(group.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="mx-8 mb-6 rounded-xl border border-white/10 bg-surface-raised/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="text-accent">⟲</span> Two-way sync ·{' '}
            {group.members.length} {group.members.length === 1 ? 'user' : 'users'}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {group.lastError
              ? `Last sync error: ${group.lastError}`
              : lastSynced
                ? `Last synced at ${lastSynced} · ${group.itemCount} items`
                : `${group.itemCount} items · not synced yet`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => syncNow.mutate()}
            disabled={syncNow.isPending}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink transition hover:bg-white/10 disabled:opacity-50"
          >
            {syncNow.isPending ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={() => unsync.mutate(ratingKey)}
            disabled={unsync.isPending}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-muted transition hover:bg-white/10 disabled:opacity-50"
          >
            Stop syncing
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.members.map((m) => (
          <span
            key={m.userUuid}
            className={`rounded-full px-2.5 py-1 text-xs ${
              m.needsAuth ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-ink-muted'
            }`}
            title={m.needsAuth ? 'Token expired — re-share this user to resume syncing' : undefined}
          >
            {m.userTitle}
            {m.needsAuth && ' ⚠'}
          </span>
        ))}
      </div>
    </div>
  )
}
