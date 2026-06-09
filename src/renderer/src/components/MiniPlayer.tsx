import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PlaybackStatus } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { useMetadata } from '../lib/hooks'
import { Icon } from './icons'

/**
 * Persistent bottom bar shown whenever something is playing. While the video is
 * minimized it's the primary control surface; while expanded it sits behind the
 * fullscreen player window. Clicking the artwork/title re-expands the video.
 */
export function MiniPlayer({ serverId }: { serverId: string }): JSX.Element | null {
  const [st, setSt] = useState<PlaybackStatus>({ active: false })

  useEffect(() => window.plex.playback.onStatus(setSt), [])

  // Fetch artwork/labels for the playing item (cached).
  const { data: item } = useMetadata(serverId, st.active && st.ratingKey ? st.ratingKey : '')

  // Only show the bar in the docked (minimized) state — when expanded/full the
  // player window covers everything and has its own overlay controls.
  if (!st.active || !st.minimized) return null

  const pct = st.durationMs ? Math.min(100, ((st.timeMs ?? 0) / st.durationMs) * 100) : 0
  const thumb = imageUrl(serverId, item?.thumb ?? item?.grandparentThumb, { width: 160, height: 90 })
  // While docked, the live mpv video is positioned over this slot, so show a
  // placeholder thumb only when NOT docked (expanded — bar hidden anyway).
  const docked = !!st.minimized
  const subtitle =
    item?.type === 'episode'
      ? `${item.grandparentTitle ?? ''}${
          item.parentIndex != null && item.index != null
            ? ` · S${item.parentIndex} · E${item.index}`
            : ''
        }`
      : item?.year
        ? String(item.year)
        : ''

  const p = window.plex.playback

  return (
    <div className="relative flex h-[72px] shrink-0 items-center gap-4 border-t border-white/10 bg-surface-raised px-4">
      {/* progress line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-white/10">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>

      {/* Live video docks over this slot while minimized; click to expand. */}
      <button onClick={() => p.expand()} className="flex min-w-0 items-center gap-3 text-left" title="Expand">
        <div className="h-[56px] w-[100px] shrink-0 overflow-hidden rounded bg-black">
          {/* When docked, leave empty (mpv video sits here); else show a thumb. */}
          {!docked && thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{item?.title ?? st.title}</p>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </button>

      {/* Transport — absolutely centered in the bar regardless of title width. */}
      <div className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-center gap-1 text-ink">
        {st.hasPrev && (
          <Btn onClick={() => p.prev()} title="Previous episode">
            <Icon name="prev" className="h-5 w-5" />
          </Btn>
        )}
        <Btn onClick={() => p.seekBy(-10)} title="Back 10s">
          <Icon name="back10" className="h-5 w-5" />
        </Btn>
        <button
          onClick={() => p.playPause()}
          className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white hover:brightness-110"
          title="Play/Pause"
        >
          <Icon name={st.paused ? 'play' : 'pause'} className="h-5 w-5" />
        </button>
        <Btn onClick={() => p.seekBy(30)} title="Forward 30s">
          <Icon name="forward30" className="h-5 w-5" />
        </Btn>
        {st.hasNext && (
          <Btn onClick={() => p.next()} title="Next episode">
            <Icon name="next" className="h-5 w-5" />
          </Btn>
        )}
      </div>

      {/* Close pinned to the right. */}
      <div className="ml-auto flex items-center text-ink">
        <Btn onClick={() => p.stop()} title="Close">
          <Icon name="close" className="h-5 w-5" />
        </Btn>
      </div>
    </div>
  )
}

function Btn({
  children,
  onClick,
  title
}: {
  children: ReactNode
  onClick: () => void
  title: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/10 hover:text-ink"
    >
      {children}
    </button>
  )
}
