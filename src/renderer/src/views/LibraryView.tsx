import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { PlexMediaItem, SectionSort } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { useInfiniteSection, useSectionMeta, useSections } from '../lib/hooks'
import { itemSubtitle, progressPercent, sectionTypeNumber } from '../lib/format'
import { MediaCard } from '../components/MediaCard'
import { FilterBar, type ActiveFilter } from '../components/FilterBar'
import { Icon } from '../components/icons'
import { SkeletonGrid } from '../components/Skeleton'
import { useNav } from '../state/nav'
import { ErrorState } from '../components/States'

const H_PADDING = 32
const GAP = 12
const LABEL_H = 48
const LIST_ROW_H = 84

// Used when a server doesn't return sort metadata.
const FALLBACK_SORTS: SectionSort[] = [
  { key: 'titleSort', title: 'Title', defaultDirection: 'asc' },
  { key: 'addedAt', title: 'Date Added', defaultDirection: 'desc' },
  { key: 'originallyAvailableAt', title: 'Release Date', defaultDirection: 'desc' },
  { key: 'year', title: 'Year', defaultDirection: 'desc' },
  { key: 'rating', title: 'Rating', defaultDirection: 'desc' },
  { key: 'lastViewedAt', title: 'Last Played', defaultDirection: 'desc' }
]

const VIEW_KEY = 'plex-library-view'
const SIZE_KEY = 'plex-library-size'

// Sort is remembered per-library (each section exposes different sort keys).
const sortStoreKey = (sectionId: string): string => `plex-library-sort:${sectionId}`

function loadSort(sectionId: string): { key: string; dir: 'asc' | 'desc' } {
  const raw = localStorage.getItem(sortStoreKey(sectionId))
  if (raw) {
    const [key, dir] = raw.split(':')
    if (key) return { key, dir: dir === 'asc' ? 'asc' : 'desc' }
  }
  return { key: 'addedAt', dir: 'desc' }
}

interface Props {
  serverId: string
  sectionId: string
  title: string
}

export function LibraryView({ serverId, sectionId, title }: Props): JSX.Element {
  const { navigate } = useNav()
  const { data: sections } = useSections(serverId)
  const sectionType = sections?.find((s) => s.key === sectionId)?.type ?? 'movie'
  const typeNum = sectionTypeNumber(sectionType)

  const { data: meta } = useSectionMeta(serverId, sectionId, typeNum)
  const sorts = meta?.sorts.length ? meta.sorts : FALLBACK_SORTS

  const [sortKey, setSortKey] = useState(() => loadSort(sectionId).key)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => loadSort(sectionId).dir)
  const [filters, setFilters] = useState<ActiveFilter[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>(
    () => (localStorage.getItem(VIEW_KEY) as 'grid' | 'list') || 'grid'
  )
  const [cellMin, setCellMin] = useState(() => Number(localStorage.getItem(SIZE_KEY)) || 150)

  const setViewMode = (v: 'grid' | 'list'): void => {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }
  const onSize = (n: number): void => {
    setCellMin(n)
    localStorage.setItem(SIZE_KEY, String(n))
  }

  const chooseSort = (key: string): void => {
    const dir = sorts.find((s) => s.key === key)?.defaultDirection ?? 'desc'
    setSortKey(key)
    setSortDir(dir)
    localStorage.setItem(sortStoreKey(sectionId), `${key}:${dir}`)
  }

  const toggleSortDir = (): void => {
    setSortDir((d) => {
      const next = d === 'asc' ? 'desc' : 'asc'
      localStorage.setItem(sortStoreKey(sectionId), `${sortKey}:${next}`)
      return next
    })
  }

  // Switching libraries restores that library's last-used sort and clears any
  // active filters (which are schema-specific to the previous library).
  useEffect(() => {
    const saved = loadSort(sectionId)
    setSortKey(saved.key)
    setSortDir(saved.dir)
    setFilters([])
    setShowFilters(false)
  }, [sectionId])

  const sort = `${sortKey}:${sortDir}`
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteSection(serverId, sectionId, {
      sort,
      type: typeNum,
      filters: filters.map((f) => ({ key: f.key, value: f.value }))
    })

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const totalSize = data?.pages[0]?.totalSize ?? 0

  // Responsive layout measurement.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const usable = Math.max(0, width - H_PADDING * 2)
  const columns = view === 'list' ? 1 : Math.max(1, Math.floor((usable + GAP) / (cellMin + GAP)))
  const cellW = columns > 0 ? Math.floor((usable - GAP * (columns - 1)) / columns) : cellMin
  const gridRowH = Math.round(cellW * 1.5) + LABEL_H + GAP
  const rowH = view === 'list' ? LIST_ROW_H : gridRowH
  const rowCount = view === 'list' ? items.length : Math.ceil(items.length / columns)

  const virt = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 6
  })

  const vRows = virt.getVirtualItems()
  useEffect(() => {
    const last = vRows[vRows.length - 1]
    if (last && last.index >= rowCount - 4 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [vRows, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {totalSize > 0 && (
              <p className="mt-1 text-sm text-ink-muted">{totalSize.toLocaleString()} items</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ name: 'collections', sectionId, title })}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-ink-muted transition hover:bg-white/5"
            >
              Collections
            </button>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                showFilters || filters.length
                  ? 'border-accent text-ink'
                  : 'border-white/10 text-ink-muted hover:bg-white/5'
              }`}
            >
              <Icon name="filter" className="h-4 w-4" />
              Filters{filters.length ? ` (${filters.length})` : ''}
            </button>

            <select
              value={sortKey}
              onChange={(e) => chooseSort(e.target.value)}
              className="rounded-lg border border-white/10 bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSortDir}
              className="rounded-lg border border-white/10 px-2.5 py-2 text-sm text-ink-muted transition hover:bg-white/5"
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '▲' : '▼'}
            </button>

            {view === 'grid' && (
              <input
                type="range"
                min={110}
                max={240}
                value={cellMin}
                onChange={(e) => onSize(Number(e.target.value))}
                className="w-24 accent-[rgb(var(--accent))]"
                title="Poster size"
              />
            )}
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-2 ${view === 'grid' ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-white/5'}`}
                title="Grid view"
              >
                <Icon name="grid" className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-2 ${view === 'list' ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-white/5'}`}
                title="List view"
              >
                <Icon name="list" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {showFilters && meta?.filters.length ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-surface-raised/50 p-4">
            <FilterBar
              serverId={serverId}
              filters={meta.filters}
              active={filters}
              onChange={setFilters}
            />
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="pt-2"><SkeletonGrid /></div>}
        {isError && (
          <ErrorState
            message={(error as Error)?.message ?? 'Failed to load'}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <p className="px-8 py-10 text-ink-muted">No items match these filters.</p>
        )}

        {!isLoading && !isError && width > 0 && items.length > 0 && (
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {vRows.map((vRow) => {
              const rowStyle = {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${vRow.start}px)`,
                height: rowH,
                paddingLeft: H_PADDING,
                paddingRight: H_PADDING
              }
              if (view === 'list') {
                return (
                  <div key={vRow.key} style={rowStyle}>
                    <ListRow serverId={serverId} item={items[vRow.index]} />
                  </div>
                )
              }
              const start = vRow.index * columns
              const rowItems = items.slice(start, start + columns)
              return (
                <div key={vRow.key} className="flex" style={{ ...rowStyle, gap: GAP }}>
                  {rowItems.map((item) => (
                    <MediaCard key={item.ratingKey} serverId={serverId} item={item} width={cellW} />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {isFetchingNextPage && (
          <p className="py-4 text-center text-sm text-ink-muted">Loading more…</p>
        )}
      </div>
    </div>
  )
}

/** Compact one-line row used in list view. */
function ListRow({ serverId, item }: { serverId: string; item: PlexMediaItem }): JSX.Element {
  const { navigate } = useNav()
  const src = imageUrl(serverId, item.thumb ?? item.parentThumb, { width: 96, height: 144 })
  const pct = progressPercent(item.viewOffset, item.duration)
  const watched = (item.viewCount ?? 0) > 0

  return (
    <button
      onClick={() => navigate({ name: 'detail', ratingKey: item.ratingKey })}
      className="flex h-[76px] w-full items-center gap-4 rounded-lg px-2 text-left transition hover:bg-white/5"
    >
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-raised">
        {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
        {pct != null && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" style={{ width: `${pct}%` }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-ink-muted">{itemSubtitle(item)}</p>
      </div>
      {item.rating ? <span className="text-xs text-ink-muted">★ {item.rating.toFixed(1)}</span> : null}
      {watched && <span className="text-accent">✓</span>}
    </button>
  )
}
