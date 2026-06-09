import { useState } from 'react'
import type { PlexMediaItem, WatchlistEntry } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { isPortrait, itemSubtitle, progressPercent } from '../lib/format'
import { useNav } from '../state/nav'
import { useToggleWatchlist, useWatchlist } from '../lib/hooks'

/** Build a lightweight watchlist snapshot from a full item. */
function toEntry(item: PlexMediaItem): WatchlistEntry {
  return {
    ratingKey: item.ratingKey,
    key: item.key,
    type: item.type,
    title: item.title,
    thumb: item.thumb,
    parentThumb: item.parentThumb,
    grandparentThumb: item.grandparentThumb,
    year: item.year,
    addedAt: Date.now()
  }
}

/** Types that make sense to save to "My List". */
const WATCHLISTABLE = new Set(['movie', 'show'])

interface Props {
  serverId: string
  item: PlexMediaItem
  /** Override the card width (e.g. to fill a responsive grid cell). */
  width?: number
  /** Stretch to fill the parent (e.g. a 1fr grid cell) instead of a fixed width. */
  fill?: boolean
}

/**
 * A single Netflix-style poster/thumb card. Portrait for posters, landscape
 * (with episode title overlay) for episodes/clips. Clicking opens the detail
 * view.
 */
export function MediaCard({ serverId, item, width, fill }: Props): JSX.Element {
  const { navigate } = useNav()
  const [imgFailed, setImgFailed] = useState(false)
  const portrait = isPortrait(item.type)
  const canWatchlist = WATCHLISTABLE.has(item.type)
  const { data: watchlist } = useWatchlist(canWatchlist ? serverId : '')
  const { add, remove } = useToggleWatchlist(serverId)
  const inList = !!watchlist?.some((e) => e.ratingKey === item.ratingKey)
  const toggleList = (e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    if (inList) remove.mutate(item.ratingKey)
    else add.mutate(toEntry(item))
  }
  const watched =
    (item.viewCount ?? 0) > 0 ||
    (item.leafCount != null && item.viewedLeafCount === item.leafCount && item.leafCount > 0)

  // Episodes look best on their show/episode landscape art; everything else on
  // its own poster, falling back to a parent thumb.
  const artPath = portrait
    ? (item.thumb ?? item.parentThumb ?? item.grandparentThumb)
    : (item.thumb ?? item.grandparentThumb ?? item.art)

  const src = imageUrl(serverId, artPath, portrait ? { width: 300, height: 450 } : { width: 400, height: 225 })
  const pct = progressPercent(item.viewOffset, item.duration)
  const subtitle = itemSubtitle(item)
  const cardWidth: number | string = fill ? '100%' : (width ?? (portrait ? 150 : 260))

  return (
    <button
      onClick={() => navigate({ name: 'detail', ratingKey: item.ratingKey })}
      className="group flex shrink-0 flex-col gap-2 text-left focus:outline-none"
      style={{ width: cardWidth }}
    >
      <div
        className="relative overflow-hidden rounded-md bg-surface-raised ring-1 ring-white/5 transition duration-200 group-hover:ring-2 group-hover:ring-accent group-focus-visible:ring-2 group-focus-visible:ring-accent"
        style={{ aspectRatio: portrait ? '2 / 3' : '16 / 9' }}
      >
        {src && !imgFailed ? (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-muted">
            {item.title}
          </div>
        )}

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {canWatchlist && (
            <button
              onClick={toggleList}
              aria-label={inList ? 'Remove from My List' : 'Add to My List'}
              title={inList ? 'Remove from My List' : 'Add to My List'}
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold shadow transition ${
                inList
                  ? 'bg-accent text-white opacity-100'
                  : 'bg-black/60 text-white opacity-0 hover:bg-black/80 group-hover:opacity-100'
              }`}
            >
              {inList ? '✓' : '＋'}
            </button>
          )}
          {watched && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white shadow">
              ✓
            </div>
          )}
        </div>

        {item.badge && (
          <div className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
            {item.badge}
          </div>
        )}

        {item.type === 'episode' && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <p className="truncate text-xs font-medium text-white">{item.title}</p>
          </div>
        )}

        {pct != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {portrait && (
        <div className="overflow-hidden px-0.5" style={{ width: cardWidth }}>
          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
      )}
      {!portrait && subtitle && (
        <div className="overflow-hidden px-0.5" style={{ width: cardWidth }}>
          <p className="truncate text-xs text-ink-muted">{subtitle}</p>
        </div>
      )}
    </button>
  )
}
