import { useState } from 'react'
import { imageUrl } from '@shared/ipc'
import { usePlaylists } from '../lib/hooks'
import { useNav } from '../state/nav'
import { Loading, ErrorState } from '../components/States'

const SMART_KEY = 'plex-playlists-show-smart'

/** Grid of the account's playlists; smart playlists are hidden by default. */
export function PlaylistsView({ serverId }: { serverId: string }): JSX.Element {
  const { data, isLoading, isError, error } = usePlaylists(serverId)
  const { navigate } = useNav()
  const [showSmart, setShowSmart] = useState(() => localStorage.getItem(SMART_KEY) === '1')

  const toggleSmart = (): void =>
    setShowSmart((on) => {
      const next = !on
      localStorage.setItem(SMART_KEY, next ? '1' : '0')
      return next
    })

  if (isLoading) return <Loading label="Loading playlists…" />
  if (isError) return <ErrorState message={(error as Error)?.message ?? 'Failed to load'} />

  const hasSmart = (data ?? []).some((pl) => pl.smart)
  const playlists = showSmart ? data : data?.filter((pl) => !pl.smart)

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between px-8">
        <h1 className="text-3xl font-bold">Playlists</h1>
        {hasSmart && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <span>Show smart playlists</span>
            <button
              onClick={toggleSmart}
              role="switch"
              aria-checked={showSmart}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                showSmart ? 'bg-accent' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  showSmart ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        )}
      </div>
      {(!playlists || playlists.length === 0) && (
        <p className="px-8 text-ink-muted">
          No playlists yet. Open any title and use “＋ Playlist” to create one.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 px-8">
        {playlists?.map((pl) => {
          const src = imageUrl(serverId, pl.composite ?? pl.thumb, { width: 440, height: 248 })
          return (
            <button
              key={pl.ratingKey}
              onClick={() => navigate({ name: 'playlist', ratingKey: pl.ratingKey, title: pl.title })}
              className="group flex flex-col gap-2 text-left"
            >
              <div
                className="relative overflow-hidden rounded-lg bg-surface-raised ring-1 ring-white/5 transition group-hover:ring-2 group-hover:ring-accent"
                style={{ aspectRatio: '16 / 9' }}
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">📜</div>
                )}
                <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px]">
                  {pl.smart ? 'Smart' : pl.playlistType}
                </div>
              </div>
              <div>
                <p className="truncate font-medium">{pl.title}</p>
                <p className="text-xs text-ink-muted">{pl.leafCount ?? 0} items</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
