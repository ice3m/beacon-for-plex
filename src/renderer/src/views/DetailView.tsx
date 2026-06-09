import { useState } from 'react'
import { imageUrl } from '@shared/ipc'
import {
  useChildren,
  useMetadata,
  useRelated,
  useSetWatched,
  useToggleWatchlist,
  useWatchlist
} from '../lib/hooks'
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatResolution,
  isPortrait,
  itemSubtitle
} from '../lib/format'
import { MediaCard } from '../components/MediaCard'
import { HubRow } from '../components/HubRow'
import { AddToPlaylist } from '../components/AddToPlaylist'
import { CastRow } from '../components/CastRow'
import { Loading, ErrorState } from '../components/States'

interface Props {
  serverId: string
  ratingKey: string
}

// Types that have a meaningful child listing (seasons, episodes, tracks).
const HAS_CHILDREN = new Set(['show', 'season', 'artist', 'album'])

/** Item detail page: hero art, metadata, summary, play, and children. */
export function DetailView({ serverId, ratingKey }: Props): JSX.Element {
  const { data: item, isLoading, isError, error } = useMetadata(serverId, ratingKey)
  const wantsChildren = !!item && HAS_CHILDREN.has(item.type)
  const { data: children } = useChildren(serverId, ratingKey, wantsChildren)
  const { data: related } = useRelated(serverId, ratingKey)
  const setWatched = useSetWatched(serverId)
  const { data: watchlist } = useWatchlist(serverId)
  const { add: addWatch, remove: removeWatch } = useToggleWatchlist(serverId)
  const [actionError, setActionError] = useState<string | null>(null)

  const canWatchlist = !!item && ['movie', 'show'].includes(item.type)
  const inWatchlist = !!watchlist?.some((e) => e.ratingKey === ratingKey)
  const toggleWatchlist = (): void => {
    if (!item) return
    if (inWatchlist) removeWatch.mutate(ratingKey)
    else
      addWatch.mutate({
        ratingKey: item.ratingKey,
        key: item.key,
        type: item.type,
        title: item.title,
        thumb: item.thumb,
        parentThumb: item.parentThumb,
        grandparentThumb: item.grandparentThumb,
        year: item.year,
        addedAt: Date.now()
      })
  }

  const play = async (): Promise<void> => {
    setActionError(null)
    try {
      const res = await window.plex.playback.start(serverId, ratingKey)
      if (!res.ok) setActionError(res.error ?? 'Playback failed to start')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Playback failed to start')
    }
  }

  const toggleWatched = (played: boolean): void => {
    setActionError(null)
    setWatched.mutate(
      { ratingKey, played },
      { onError: (e) => setActionError(e instanceof Error ? e.message : 'Could not update') }
    )
  }

  if (isLoading) return <Loading label="Loading…" />
  if (isError) return <ErrorState message={(error as Error)?.message ?? 'Failed to load'} />
  if (!item) return <ErrorState message="Item not found" />

  const heroSrc = imageUrl(serverId, item.art ?? item.thumb, { width: 1280, height: 720 })
  const posterSrc = imageUrl(serverId, item.thumb ?? item.parentThumb, { width: 360, height: 540 })
  const playableType = ['movie', 'episode', 'track', 'clip'].includes(item.type)
  const isWatched =
    (item.viewCount ?? 0) > 0 ||
    (item.leafCount != null && item.viewedLeafCount === item.leafCount && item.leafCount > 0)
  const hasMarkers = (item.markers?.length ?? 0) > 0
  const v = item.media?.[0]

  return (
    <div>
      {/* Hero */}
      <div className="relative h-[42vh] min-h-[320px] w-full overflow-hidden">
        {heroSrc && <img src={heroSrc} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
      </div>

      <div className="relative -mt-32 flex gap-6 px-8">
        {posterSrc && (
          <img
            src={posterSrc}
            alt={item.title}
            className="mt-20 hidden w-60 shrink-0 self-start rounded-lg shadow-2xl ring-1 ring-white/10 sm:block"
            style={{ aspectRatio: '2 / 3', objectFit: 'cover' }}
          />
        )}

        <div className="flex-1 pt-20">
          {item.grandparentTitle && (
            <p className="mb-1 text-sm text-ink-muted">{item.grandparentTitle}</p>
          )}
          <h1 className="mb-2 text-4xl font-bold">{item.title}</h1>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            {item.year && <span>{item.year}</span>}
            {item.duration ? <span>{formatDuration(item.duration)}</span> : null}
            {item.contentRating && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs">
                {item.contentRating}
              </span>
            )}
            {v?.videoResolution && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-ink">
                {formatResolution(v.videoResolution)}
              </span>
            )}
            {item.rating ? <span>★ {item.rating.toFixed(1)}</span> : null}
            {item.audienceRating ? <span>👥 {item.audienceRating.toFixed(1)}</span> : null}
            {item.originallyAvailableAt && <span>{formatDate(item.originallyAvailableAt)}</span>}
            {!item.year && itemSubtitle(item) && <span>{itemSubtitle(item)}</span>}
          </div>

          {item.tagline && <p className="mb-3 text-sm italic text-ink-muted">{item.tagline}</p>}

          <div className="mb-5 flex items-center gap-3">
            <button
              disabled={!playableType}
              onClick={play}
              title={playableType ? 'Play' : 'Open an episode/track to play'}
              className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.viewOffset ? '▶ Resume' : '▶ Play'}
            </button>
            <AddToPlaylist serverId={serverId} item={item} />
            {canWatchlist && (
              <button
                onClick={toggleWatchlist}
                className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/10"
                title={inWatchlist ? 'Remove from My List' : 'Add to My List'}
              >
                {inWatchlist ? '✓ My List' : '＋ My List'}
              </button>
            )}
            <button
              onClick={() => toggleWatched(!isWatched)}
              disabled={setWatched.isPending}
              className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/10 disabled:opacity-50"
              title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
            >
              {isWatched ? '✓ Watched' : '＋ Mark watched'}
            </button>
          </div>

          {actionError && (
            <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {actionError}
            </p>
          )}

          {hasMarkers && (
            <p className="mb-4 text-xs text-ink-muted">
              ⏭ Intro/credits markers detected — skip prompts and auto-skip (per your Playback
              settings) apply during playback.
            </p>
          )}

          {item.summary && (
            <p className="max-w-3xl text-sm leading-relaxed text-ink/90">{item.summary}</p>
          )}

          {item.directors?.length || item.writers?.length ? (
            <div className="mt-4 space-y-1 text-sm">
              {item.directors?.length ? (
                <p>
                  <span className="text-ink-muted">Directed by </span>
                  <span className="text-ink">{item.directors.join(', ')}</span>
                </p>
              ) : null}
              {item.writers?.length ? (
                <p>
                  <span className="text-ink-muted">Written by </span>
                  <span className="text-ink">{item.writers.join(', ')}</span>
                </p>
              ) : null}
              {item.studio ? (
                <p>
                  <span className="text-ink-muted">Studio </span>
                  <span className="text-ink">{item.studio}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {item.genres?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-ink-muted"
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {item.collections?.length ? (
            <p className="mt-3 text-sm">
              <span className="text-ink-muted">Collections: </span>
              <span className="text-ink">{item.collections.join(', ')}</span>
            </p>
          ) : null}

          {v && (v.videoCodec || v.audioCodec || v.container || v.size) ? (
            <p className="mt-3 text-xs text-ink-muted">
              {[
                v.videoResolution && formatResolution(v.videoResolution),
                v.videoCodec?.toUpperCase(),
                v.audioCodec?.toUpperCase(),
                v.audioChannels ? `${v.audioChannels}ch` : null,
                v.container?.toUpperCase(),
                formatBytes(v.size)
              ]
                .filter(Boolean)
                .join(' · ')}
              {item.media && item.media.length > 1 ? ` · ${item.media.length} versions` : ''}
            </p>
          ) : null}
        </div>
      </div>

      {/* Children (seasons / episodes / tracks) — shown above Cast & Crew. */}
      {wantsChildren && children && children.length > 0 && (
        <div className="mt-10 px-8">
          <h2 className="mb-4 text-xl font-semibold">
            {item.type === 'show' ? 'Seasons' : item.type === 'artist' ? 'Albums' : 'Episodes'}
          </h2>
          <div
            className="grid gap-x-3 gap-y-6"
            style={{
              // Landscape children (episodes/clips) need a wider track than
              // portrait posters (seasons/albums) so cards don't overlap.
              gridTemplateColumns: `repeat(auto-fill, minmax(${
                isPortrait(children[0].type) ? 150 : 260
              }px, 1fr))`
            }}
          >
            {children.map((child) => (
              <MediaCard key={child.ratingKey} serverId={serverId} item={child} fill />
            ))}
          </div>
        </div>
      )}

      {item.roles && (
        <CastRow serverId={serverId} roles={item.roles} sectionId={item.librarySectionID} />
      )}

      {/* More Like This / Related */}
      {related && related.length > 0 && (
        <div className="mt-10">
          {related.map((hub) => (
            <HubRow
              key={hub.hubIdentifier}
              serverId={serverId}
              title={hub.title}
              items={hub.items}
            />
          ))}
        </div>
      )}

      <div className="pb-10" />
    </div>
  )
}
