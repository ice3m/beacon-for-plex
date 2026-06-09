import { useState } from 'react'
import type { PlexMediaItem } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { progressPercent } from '../lib/format'
import { useNav } from '../state/nav'

interface Props {
  serverId: string
  item: PlexMediaItem
}

/**
 * Continue Watching card. Shows landscape art with a resume bar, and — for
 * episodes — two distinct clickable targets: the full show, and the specific
 * season/episode. Movies show a single clickable title.
 */
export function ContinueCard({ serverId, item }: Props): JSX.Element {
  const { navigate } = useNav()
  const [imgFailed, setImgFailed] = useState(false)
  const isEpisode = item.type === 'episode'

  const artPath = isEpisode ? (item.thumb ?? item.grandparentThumb) : (item.art ?? item.thumb)
  const src = imageUrl(serverId, artPath, { width: 480, height: 270 })
  const pct = progressPercent(item.viewOffset, item.duration)

  const resume = (): void => {
    window.plex.playback.start(serverId, item.ratingKey).catch(() => {})
  }
  const openEpisode = (): void => navigate({ name: 'detail', ratingKey: item.ratingKey })
  const openShow = (): void => {
    if (item.grandparentRatingKey)
      navigate({ name: 'detail', ratingKey: item.grandparentRatingKey })
  }

  const seasonEpisode =
    item.parentIndex != null && item.index != null
      ? `S${item.parentIndex} · E${item.index}`
      : null

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2">
      <button
        onClick={resume}
        className="group relative overflow-hidden rounded-md bg-surface-raised ring-1 ring-white/5 transition hover:ring-2 hover:ring-accent"
        style={{ aspectRatio: '16 / 9' }}
        title="Resume"
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
        {/* Play affordance on hover */}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur">
            ▶
          </span>
        </span>
        {pct != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>

      {isEpisode ? (
        <div className="min-w-0">
          {/* Full show — clickable */}
          <button
            onClick={openShow}
            className="block max-w-full truncate text-left text-sm font-semibold text-ink transition hover:text-accent"
            title={item.grandparentTitle}
          >
            {item.grandparentTitle ?? item.title}
          </button>
          {/* Season/episode — clickable */}
          <button
            onClick={openEpisode}
            className="block max-w-full truncate text-left text-xs text-ink-muted transition hover:text-accent"
            title={item.title}
          >
            {seasonEpisode ? `${seasonEpisode} · ${item.title}` : item.title}
          </button>
        </div>
      ) : (
        <button
          onClick={openEpisode}
          className="block max-w-full truncate text-left text-sm font-semibold text-ink transition hover:text-accent"
          title={item.title}
        >
          {item.title}
          {item.year ? <span className="font-normal text-ink-muted"> · {item.year}</span> : null}
        </button>
      )}
    </div>
  )
}
