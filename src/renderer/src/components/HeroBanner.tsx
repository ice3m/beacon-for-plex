import { useEffect, useState } from 'react'
import type { PlexMediaItem } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { itemSubtitle } from '../lib/format'
import { useNav } from '../state/nav'

interface Props {
  serverId: string
  items: PlexMediaItem[]
}

/** A rotating featured spotlight at the top of Home. */
export function HeroBanner({ serverId, items }: Props): JSX.Element | null {
  const { navigate } = useNav()
  const [idx, setIdx] = useState(0)
  const slides = items.slice(0, 5)
  const firstKey = slides[0]?.ratingKey

  // Reset to the first slide when the underlying items change (e.g. library swap).
  useEffect(() => setIdx(0), [firstKey])

  // Auto-advance every 8s (paused implicitly when only one slide).
  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 8000)
    return () => clearInterval(t)
  }, [slides.length])

  if (slides.length === 0) return null
  const item = slides[Math.min(idx, slides.length - 1)]
  const bg = imageUrl(serverId, item.art ?? item.thumb, { width: 1600, height: 900 })
  const open = (): void => navigate({ name: 'detail', ratingKey: item.ratingKey })

  return (
    <div className="relative mb-8 h-[46vh] min-h-[320px] w-full overflow-hidden">
      {bg && <img src={bg} alt="" className="h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 max-w-2xl p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
          Featured
        </p>
        <h2 className="mb-2 text-4xl font-bold drop-shadow">{item.title}</h2>
        <div className="mb-3 flex items-center gap-3 text-sm text-ink-muted">
          {item.year && <span>{item.year}</span>}
          {item.contentRating && (
            <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs">
              {item.contentRating}
            </span>
          )}
          {itemSubtitle(item) && <span>{itemSubtitle(item)}</span>}
        </div>
        {item.summary && (
          <p className="mb-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-ink/90">
            {item.summary}
          </p>
        )}
        <button
          onClick={open}
          className="rounded-lg bg-accent px-6 py-2.5 font-semibold text-white transition hover:brightness-110"
        >
          View details
        </button>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-5 right-8 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.ratingKey}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-6 bg-accent' : 'w-2.5 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
