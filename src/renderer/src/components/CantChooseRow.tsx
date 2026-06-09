import { useEffect, useMemo, useState } from 'react'
import type { PlexMediaItem } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import { useGenres, useRandomPick, useSections } from '../lib/hooks'
import { itemSubtitle } from '../lib/format'
import { useNav } from '../state/nav'
import { Icon } from './icons'

const VIDEO_TYPES = new Set(['movie', 'show'])

/**
 * "Can't Choose What to Watch?" — a compact, playful panel that picks a random
 * title for you, filtered by chosen libraries and an optional genre. Styled
 * with the active accent so it's inviting to tap.
 */
export function CantChooseRow({ serverId }: { serverId: string }): JSX.Element | null {
  const { navigate } = useNav()
  const { data: sections } = useSections(serverId)
  const libraries = useMemo(
    () => (sections ?? []).filter((s) => !s.hidden && VIDEO_TYPES.has(s.type)),
    [sections]
  )

  // Empty selection = "All Libraries".
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [genre, setGenre] = useState('')
  const [result, setResult] = useState<PlexMediaItem | null | undefined>(undefined)

  const sectionIds = useMemo(() => [...selected], [selected])
  const { data: genres } = useGenres(serverId, sectionIds)
  const pick = useRandomPick(serverId)

  // Drop the chosen genre if it's no longer offered by the current selection.
  useEffect(() => {
    if (genre && genres && !genres.includes(genre)) setGenre('')
  }, [genres, genre])

  if (libraries.length === 0) return null

  const toggleLib = (key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setResult(undefined)
  }

  const surprise = (): void => {
    pick.mutate(
      { sectionIds: selected.size ? [...selected] : undefined, genre: genre || undefined },
      { onSuccess: (item) => setResult(item), onError: () => setResult(null) }
    )
  }

  const chip = (active: boolean): string =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      active
        ? 'bg-accent text-white shadow'
        : 'bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink'
    }`

  return (
    <section className="px-8">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-surface-raised to-surface-raised p-5 ring-1 ring-accent/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Icon name="dice" className="h-5 w-5 text-accent" /> Can&apos;t Choose What to Watch?
            </h2>
            <p className="text-xs text-ink-muted">Let the app pick something for you.</p>
          </div>
          <button
            onClick={surprise}
            disabled={pick.isPending}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-70"
          >
            <Icon
              name="dice"
              className={`h-4 w-4 ${pick.isPending ? 'animate-bounce' : ''}`}
            />
            {pick.isPending ? 'Shuffling…' : 'Surprise Me'}
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => { setSelected(new Set()); setResult(undefined) }} className={chip(selected.size === 0)}>
            All Libraries
          </button>
          {libraries.map((lib) => (
            <button key={lib.key} onClick={() => toggleLib(lib.key)} className={chip(selected.has(lib.key))}>
              {lib.title}
            </button>
          ))}

          {genres && genres.length > 0 && (
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value)
                setResult(undefined)
              }}
              className="ml-auto rounded-full border border-white/10 bg-surface px-3 py-1 text-xs outline-none focus:border-accent"
            >
              <option value="">Any Genre</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Result */}
        {result === null && (
          <p className="mt-4 text-sm text-ink-muted">
            No matches for those filters — try a different mix.
          </p>
        )}
        {result && <ResultCard key={result.ratingKey} serverId={serverId} item={result} onOpen={() => navigate({ name: 'detail', ratingKey: result.ratingKey })} onAgain={surprise} again={pick.isPending} />}
      </div>
    </section>
  )
}

function ResultCard({
  serverId,
  item,
  onOpen,
  onAgain,
  again
}: {
  serverId: string
  item: PlexMediaItem
  onOpen: () => void
  onAgain: () => void
  again: boolean
}): JSX.Element {
  const poster = imageUrl(serverId, item.thumb ?? item.grandparentThumb, { width: 120, height: 180 })
  const subtitle = itemSubtitle(item)
  return (
    <div className="mt-4 flex items-center gap-4 rounded-xl bg-black/20 p-3 ring-1 ring-white/10 motion-safe:animate-[fadeIn_300ms_ease-out]">
      <button onClick={onOpen} className="shrink-0">
        <div className="h-24 w-16 overflow-hidden rounded-md bg-surface ring-1 ring-white/10">
          {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
        </div>
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block text-left">
          <p className="truncate text-base font-semibold hover:text-accent">{item.title}</p>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </button>
        {item.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{item.summary}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            onClick={onOpen}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
          >
            ▶ Watch
          </button>
          <button
            onClick={onAgain}
            disabled={again}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink transition hover:bg-white/10 disabled:opacity-50"
          >
            <Icon name="dice" className={`h-3.5 w-3.5 ${again ? 'animate-bounce' : ''}`} /> Again
          </button>
        </div>
      </div>
    </div>
  )
}
