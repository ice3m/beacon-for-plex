import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { PlexMediaItem } from '@shared/types'
import { MediaCard } from './MediaCard'
import { Icon } from './icons'

interface Props {
  serverId: string
  title: string
  items: PlexMediaItem[]
  /** Optional custom card renderer (defaults to MediaCard). */
  renderItem?: (item: PlexMediaItem) => ReactNode
}

/** A titled, horizontally-scrolling row of cards with hover scroll buttons. */
export function HubRow({ serverId, title, items, renderItem }: Props): JSX.Element | null {
  const scroller = useRef<HTMLDivElement>(null)
  if (items.length === 0) return null

  const scrollBy = (dir: 1 | -1): void => {
    scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="group/row relative mb-8">
      <h3 className="mb-3 px-8 text-lg font-semibold text-ink">{title}</h3>
      <div className="relative">
        {/* Arrows span only the artwork height (top-0 → bottom-12 clears the
            title/subtitle below each card) so the button centers on the poster. */}
        <button
          onClick={() => scrollBy(-1)}
          className="absolute bottom-12 left-0 top-0 z-10 flex w-16 items-center justify-start bg-gradient-to-r from-surface via-surface/85 to-transparent pl-3 opacity-0 transition group-hover/row:opacity-100"
          aria-label="Scroll left"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80">
            <Icon name="chevronLeft" className="h-7 w-7" />
          </span>
        </button>
        <div
          ref={scroller}
          className="flex gap-3 overflow-x-auto scroll-smooth px-8 pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item) =>
            renderItem ? (
              <div key={`${item.ratingKey}-${item.key}`}>{renderItem(item)}</div>
            ) : (
              <MediaCard key={`${item.ratingKey}-${item.key}`} serverId={serverId} item={item} />
            )
          )}
        </div>
        <button
          onClick={() => scrollBy(1)}
          className="absolute bottom-12 right-0 top-0 z-10 flex w-16 items-center justify-end bg-gradient-to-l from-surface via-surface/85 to-transparent pr-3 opacity-0 transition group-hover/row:opacity-100"
          aria-label="Scroll right"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80">
            <Icon name="chevronLeft" className="h-7 w-7 rotate-180" />
          </span>
        </button>
      </div>
    </section>
  )
}
