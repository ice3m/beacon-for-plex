import type {
  PlexHub,
  PlexLibrarySection,
  PlexMediaItem,
  PlexPlaylist,
  PlexServerAccount,
  SectionPage,
  SectionQuery
} from '@shared/types'
import { getClientIdentifier, getHiddenLibraries, getLibraryIcons, getLibraryOrder } from '../store'
import { readMetaCache, writeMetaCache } from './metaCache'
import { PLEX_PRODUCT, plexHeaders } from './headers'
import { getServerById } from './servers'
import type { QualityOption } from '@shared/quality'

/** Raw MediaContainer envelope Plex wraps every response in. */
interface MediaContainer<T = unknown> {
  MediaContainer: {
    size?: number
    totalSize?: number
    offset?: number
    Directory?: T[]
    Metadata?: T[]
    Hub?: T[]
    Playlist?: T[]
  }
}

// Transient HTTP statuses worth retrying (rate-limit, gateway, unavailable).
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * fetch() with a per-request timeout and a few retries with exponential backoff
 * on transient failures (network errors or 5xx/408/429). Callers still inspect
 * `res.ok`. Safe for the idempotent GETs we use it for.
 */
async function fetchRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 15000): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (i < attempts - 1 && RETRYABLE_STATUS.has(res.status)) {
        await sleep(250 * 2 ** i)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await sleep(250 * 2 ** i)
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/** Perform an authenticated GET against the server's best connection. */
async function serverGet<T>(serverId: string, path: string): Promise<MediaContainer<T>> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const url = `${server.bestConnection.uri}${path}`
  const res = await fetchRetry(url, { headers: plexHeaders(server.accessToken) })
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
  return (await res.json()) as MediaContainer<T>
}

/**
 * Like serverGet, but write-through to the on-disk metadata cache and fall back
 * to it when the server is unreachable (offline-friendly detail pages). The
 * full-database prewarm uses this path to warm metadata.
 */
async function serverGetCached<T>(serverId: string, path: string): Promise<MediaContainer<T>> {
  try {
    const data = await serverGet<T>(serverId, path)
    void writeMetaCache(serverId, path, data)
    return data
  } catch (err) {
    const cached = await readMetaCache<MediaContainer<T>>(serverId, path)
    if (cached) return cached
    throw err
  }
}

/** Fire an authenticated GET where we don't care about the body (scrobble, etc.). */
async function serverHit(serverId: string, path: string): Promise<void> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const res = await fetchRetry(`${server.bestConnection.uri}${path}`, {
    headers: plexHeaders(server.accessToken)
  })
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
}

/** Perform an authenticated mutating request (PUT/POST/DELETE). */
async function serverSend(
  serverId: string,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string
): Promise<Response> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  // Plex mutations here (scrobble, playlist edits, prefs) are idempotent enough
  // to retry safely on transient/network errors.
  const res = await fetchRetry(`${server.bestConnection.uri}${path}`, {
    method,
    headers: plexHeaders(server.accessToken)
  })
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`)
  return res
}

// --- Mappers ---------------------------------------------------------------

function mapItem(raw: Record<string, unknown>): PlexMediaItem {
  return {
    ratingKey: String(raw.ratingKey ?? raw.key ?? ''),
    key: String(raw.key ?? ''),
    type: String(raw.type ?? 'unknown'),
    title: String(raw.title ?? ''),
    titleSort: opt(raw.titleSort),
    summary: opt(raw.summary),
    year: num(raw.year),
    thumb: opt(raw.thumb),
    art: opt(raw.art),
    parentThumb: opt(raw.parentThumb),
    grandparentThumb: opt(raw.grandparentThumb),
    duration: num(raw.duration),
    addedAt: num(raw.addedAt),
    updatedAt: num(raw.updatedAt),
    lastViewedAt: num(raw.lastViewedAt),
    viewCount: num(raw.viewCount),
    viewOffset: num(raw.viewOffset),
    index: num(raw.index),
    parentIndex: num(raw.parentIndex),
    parentTitle: opt(raw.parentTitle),
    grandparentTitle: opt(raw.grandparentTitle),
    parentRatingKey: optStr(raw.parentRatingKey),
    grandparentRatingKey: optStr(raw.grandparentRatingKey),
    childCount: num(raw.childCount),
    leafCount: num(raw.leafCount),
    viewedLeafCount: num(raw.viewedLeafCount),
    contentRating: opt(raw.contentRating),
    rating: num(raw.rating),
    librarySectionID: optStr(raw.librarySectionID),
    playlistItemID: optStr(raw.playlistItemID)
  }
}

const opt = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const optStr = (v: unknown): string | undefined => (v != null ? String(v) : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

// --- Library ---------------------------------------------------------------

export async function getSections(serverId: string): Promise<PlexLibrarySection[]> {
  const data = await serverGet<Record<string, unknown>>(serverId, '/library/sections')
  const icons = getLibraryIcons()
  const hidden = new Set(getHiddenLibraries())
  const sections = (data.MediaContainer.Directory ?? []).map((d) => {
    const key = String(d.key ?? '')
    return {
      key,
      title: String(d.title ?? ''),
      type: String(d.type ?? ''),
      agent: String(d.agent ?? ''),
      scanner: String(d.scanner ?? ''),
      language: String(d.language ?? ''),
      uuid: String(d.uuid ?? ''),
      updatedAt: num(d.updatedAt) ?? 0,
      customIcon: icons[key] ?? null,
      hidden: hidden.has(key)
    }
  })

  // Apply the user's saved order: listed ids first (in order), then any new
  // libraries the server has that aren't in the saved order yet.
  const order = getLibraryOrder()
  if (order.length === 0) return sections
  const rank = new Map(order.map((id, i) => [id, i]))
  return sections.sort(
    (a, b) => (rank.get(a.key) ?? 1e9) - (rank.get(b.key) ?? 1e9)
  )
}

export async function getSectionContents(
  serverId: string,
  sectionId: string,
  query: SectionQuery = {}
): Promise<SectionPage> {
  const params = new URLSearchParams()
  if (query.sort) params.set('sort', query.sort)
  if (query.type != null) params.set('type', String(query.type))
  for (const f of query.filters ?? []) params.set(f.key, f.value)
  const start = query.start ?? 0
  const size = query.size ?? 60
  const path = `/library/sections/${sectionId}/all?${params.toString()}`
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  // Plex paginates via X-Plex-Container-Start/Size headers.
  const res = await fetch(`${server.bestConnection.uri}${path}`, {
    headers: {
      ...plexHeaders(server.accessToken),
      'X-Plex-Container-Start': String(start),
      'X-Plex-Container-Size': String(size)
    }
  })
  if (!res.ok) throw new Error(`section contents failed (${res.status})`)
  const data = (await res.json()) as MediaContainer<Record<string, unknown>>
  return {
    items: (data.MediaContainer.Metadata ?? []).map(mapItem),
    totalSize: data.MediaContainer.totalSize ?? data.MediaContainer.size ?? 0,
    offset: data.MediaContainer.offset ?? start
  }
}

function mapHubs(raw: MediaContainer<Record<string, unknown>>): PlexHub[] {
  return (raw.MediaContainer.Hub ?? []).map((h) => ({
    hubIdentifier: String(h.hubIdentifier ?? ''),
    title: String(h.title ?? ''),
    type: String(h.type ?? ''),
    more: opt(h.more) ?? (h.more === true ? 'true' : undefined),
    items: (((h.Metadata as unknown[]) ?? (h.Directory as unknown[]) ?? []) as Record<
      string,
      unknown
    >[]).map(mapItem)
  })).filter((hub) => hub.items.length > 0)
}

export async function getHomeHubs(serverId: string): Promise<PlexHub[]> {
  const data = await serverGet<Record<string, unknown>>(
    serverId,
    '/hubs?includeEmpty=0&count=20'
  )
  return mapHubs(data)
}

/**
 * Server-provided sort + filter options for a section (includeMeta), so the UI
 * offers exactly what this server supports (e.g. TV's "Last Episode Added").
 */
export async function getSectionMeta(
  serverId: string,
  sectionId: string,
  type: number
): Promise<import('@shared/types').SectionMeta> {
  const data = (await serverGetSized(
    serverId,
    `/library/sections/${sectionId}/all?type=${type}&includeMeta=1&includeAdvanced=1`,
    0
  )) as {
    MediaContainer: {
      Meta?: {
        Type?: {
          Sort?: { key: string; title: string; defaultDirection?: string }[]
          Filter?: { filter: string; title: string; filterType: string; key: string }[]
        }[]
      }
    }
  }
  const typeMeta = data.MediaContainer.Meta?.Type?.[0]
  const sorts = (typeMeta?.Sort ?? []).map((s) => ({
    key: s.key,
    title: s.title,
    defaultDirection: s.defaultDirection === 'desc' ? ('desc' as const) : ('asc' as const)
  }))
  const filters = (typeMeta?.Filter ?? []).map((f) => ({
    filter: f.filter,
    title: f.title,
    filterType: f.filterType,
    key: f.key
  }))
  return { sorts, filters }
}

/** Selectable values for a filter, fetched from its key path. */
export async function getFilterValues(
  serverId: string,
  filterKey: string
): Promise<import('@shared/types').FilterValue[]> {
  // filterKey may be a full path or relative; normalize to a leading slash.
  const path = filterKey.startsWith('/') ? filterKey : `/${filterKey}`
  const data = await serverGet<Record<string, unknown>>(serverId, path)
  return (data.MediaContainer.Directory ?? []).map((d) => ({
    key: String(d.key ?? d.fastKey ?? ''),
    title: String(d.title ?? '')
  }))
}

// --- "Surprise me" random picker ------------------------------------------

/** Video libraries are the sensible pool for "what to watch". */
const VIDEO_TYPES = new Set(['movie', 'show'])

/** Resolve the candidate sections: the given ids, or all video libraries. */
async function candidateSections(
  serverId: string,
  sectionIds?: string[]
): Promise<PlexLibrarySection[]> {
  const sections = (await getSections(serverId)).filter((s) => VIDEO_TYPES.has(s.type))
  if (!sectionIds || sectionIds.length === 0) return sections
  const want = new Set(sectionIds)
  return sections.filter((s) => want.has(s.key))
}

/** Map of lowercased genre title → filter id for one section. */
async function sectionGenreMap(serverId: string, sectionId: string): Promise<Map<string, string>> {
  try {
    const values = await getFilterValues(serverId, `/library/sections/${sectionId}/genre`)
    return new Map(values.map((v) => [v.title.toLowerCase(), v.key]))
  } catch {
    return new Map()
  }
}

/** Distinct genre titles (sorted) across the candidate libraries. */
export async function getGenres(serverId: string, sectionIds?: string[]): Promise<string[]> {
  const sections = await candidateSections(serverId, sectionIds)
  const perSection = await Promise.all(
    sections.map((s) =>
      getFilterValues(serverId, `/library/sections/${s.key}/genre`).catch(() => [])
    )
  )
  const titles = new Set<string>()
  for (const values of perSection) for (const v of values) if (v.title) titles.add(v.title)
  return [...titles].sort((a, b) => a.localeCompare(b))
}

/**
 * Pick a single random item across the candidate libraries, honoring an
 * optional genre. Uses each section's filtered count + a weighted random
 * offset (two light requests per section) so it scales to huge libraries.
 */
export async function pickRandom(
  serverId: string,
  opts: { sectionIds?: string[]; genre?: string } = {}
): Promise<PlexMediaItem | null> {
  const sections = await candidateSections(serverId, opts.sectionIds)
  const genre = opts.genre?.trim()

  // Build per-section filters + counts (probed in parallel).
  type Bucket = { sectionId: string; filters: { key: string; value: string }[]; count: number }
  const probed = await Promise.all(
    sections.map(async (section): Promise<Bucket | null> => {
      let filters: { key: string; value: string }[] = []
      if (genre) {
        const map = await sectionGenreMap(serverId, section.key)
        const id = map.get(genre.toLowerCase())
        if (!id) return null // genre absent from this library → skip it
        filters = [{ key: 'genre', value: id }]
      }
      const probe = await getSectionContents(serverId, section.key, { filters, size: 1, start: 0 })
      return probe.totalSize > 0 ? { sectionId: section.key, filters, count: probe.totalSize } : null
    })
  )
  const buckets = probed.filter((b): b is Bucket => b !== null)

  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  if (total === 0) return null

  // Uniform pick across the whole filtered pool.
  let r = Math.floor(Math.random() * total)
  const bucket = buckets.find((b) => (r < b.count ? true : ((r -= b.count), false)))!
  const page = await getSectionContents(serverId, bucket.sectionId, {
    filters: bucket.filters,
    size: 1,
    start: r
  })
  return page.items[0] ?? null
}

/** Global search across libraries, returned as typed hubs. */
export async function search(serverId: string, query: string): Promise<PlexHub[]> {
  const q = query.trim()
  if (!q) return []
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/hubs/search?query=${encodeURIComponent(q)}&limit=12`,
    50
  )
  // Only keep hubs whose items are openable media (have a ratingKey).
  const MEDIA = new Set([
    'movie',
    'show',
    'season',
    'episode',
    'artist',
    'album',
    'track',
    'clip',
    'collection',
    'playlist'
  ])
  return mapHubs(data).filter((hub) => MEDIA.has(hub.type))
}

/** Authenticated GET with Plex pagination headers. */
async function serverGetSized<T>(
  serverId: string,
  path: string,
  size: number
): Promise<MediaContainer<T>> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const res = await fetchRetry(`${server.bestConnection.uri}${path}`, {
    headers: {
      ...plexHeaders(server.accessToken),
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': String(size)
    }
  })
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
  return (await res.json()) as MediaContainer<T>
}

/** In-progress + next-up items across all libraries (Continue Watching). */
export async function getOnDeck(serverId: string): Promise<PlexMediaItem[]> {
  const data = await serverGetSized<Record<string, unknown>>(serverId, '/library/onDeck', 30)
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/** Recently watched items (play history), newest first. When `accountId` is a
 * positive number, only that server account's history is returned. */
export async function getHistory(serverId: string, accountId?: number): Promise<PlexMediaItem[]> {
  let path = '/status/sessions/history/all?sort=viewedAt:desc'
  if (accountId && accountId > 0) path += `&accountID=${accountId}`
  const data = await serverGetSized<Record<string, unknown>>(serverId, path, 100)
  return (data.MediaContainer.Metadata ?? []).map((raw) => {
    const item = mapItem(raw)
    const viewedAt = num(raw.viewedAt)
    if (viewedAt) item.lastViewedAt = viewedAt
    return item
  })
}

/** Accounts known to the server (owner + shared users), for the history filter. */
export async function getServerAccounts(serverId: string): Promise<PlexServerAccount[]> {
  const data = await serverGetSized<Record<string, unknown>>(serverId, '/accounts', 50)
  const arr = (data.MediaContainer as Record<string, unknown>).Account as
    | Record<string, unknown>[]
    | undefined
  return (arr ?? [])
    .map((a) => ({
      id: Number(a.id),
      name: String(a.name ?? a.title ?? 'User'),
      thumb: (a.thumb as string) || null
    }))
    // id 0 is the synthetic "all users" row Plex returns — drop it.
    .filter((a) => Number.isFinite(a.id) && a.id > 0 && a.name)
}

/**
 * Recently added for a section. TV libraries collapse to the shows that gained
 * new episodes (deduped by show, labeled with the new episode) so existing
 * shows resurface — not just brand-new shows.
 */
export async function getRecentlyAdded(
  serverId: string,
  sectionId: string,
  sectionType: string
): Promise<PlexMediaItem[]> {
  if (sectionType === 'show') {
    // Pull recently-added EPISODES (type=4), then collapse to their shows.
    const data = await serverGetSized<Record<string, unknown>>(
      serverId,
      `/library/sections/${sectionId}/all?type=4&sort=addedAt:desc`,
      80
    )
    const episodes = (data.MediaContainer.Metadata ?? []).map(mapItem)
    const seen = new Set<string>()
    const shows: PlexMediaItem[] = []
    for (const ep of episodes) {
      const showKey = ep.grandparentRatingKey
      if (!showKey || seen.has(showKey)) continue
      seen.add(showKey)
      const label =
        ep.parentIndex != null && ep.index != null
          ? `New: S${ep.parentIndex} · E${ep.index}`
          : 'New episode'
      shows.push({
        ratingKey: showKey,
        key: `/library/metadata/${showKey}`,
        type: 'show',
        title: ep.grandparentTitle ?? ep.title,
        thumb: ep.grandparentThumb,
        addedAt: ep.addedAt,
        badge: label
      })
      if (shows.length >= 24) break
    }
    return shows
  }

  // Movies / music / photos: the section's own recentlyAdded feed.
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/library/sections/${sectionId}/recentlyAdded`,
    24
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

export async function getSectionHubs(
  serverId: string,
  sectionId: string
): Promise<PlexHub[]> {
  const data = await serverGet<Record<string, unknown>>(
    serverId,
    `/hubs/sections/${sectionId}?count=20`
  )
  return mapHubs(data)
}

export async function getMetadata(
  serverId: string,
  ratingKey: string
): Promise<PlexMediaItem | null> {
  // includeMarkers surfaces intro/credit markers for skip-intro / skip-credits.
  const data = await serverGetCached<Record<string, unknown>>(
    serverId,
    `/library/metadata/${ratingKey}?includeMarkers=1`
  )
  const raw = data.MediaContainer.Metadata?.[0]
  if (!raw) return null
  const item = mapItem(raw)
  const markers = (raw.Marker as Record<string, unknown>[] | undefined)?.map((m) => ({
    type: String(m.type ?? ''),
    startTimeOffset: num(m.startTimeOffset) ?? 0,
    endTimeOffset: num(m.endTimeOffset) ?? 0,
    final: m.final === true
  }))
  if (markers?.length) item.markers = markers

  const roles = (raw.Role as Record<string, unknown>[] | undefined)?.map((r, i) => ({
    id: optStr(r.id) ?? String(i),
    tag: String(r.tag ?? ''),
    role: opt(r.role),
    thumb: opt(r.thumb)
  }))
  if (roles?.length) item.roles = roles

  const tagList = (key: 'Director' | 'Writer'): string[] | undefined =>
    (raw[key] as Record<string, unknown>[] | undefined)
      ?.map((t) => String(t.tag ?? ''))
      .filter(Boolean)
  const directors = tagList('Director')
  const writers = tagList('Writer')
  if (directors?.length) item.directors = directors
  if (writers?.length) item.writers = writers

  const genres = (raw.Genre as Record<string, unknown>[] | undefined)
    ?.map((g) => String(g.tag ?? ''))
    .filter(Boolean)
  if (genres?.length) item.genres = genres
  const collections = (raw.Collection as Record<string, unknown>[] | undefined)
    ?.map((c) => String(c.tag ?? ''))
    .filter(Boolean)
  if (collections?.length) item.collections = collections

  item.studio = opt(raw.studio)
  item.tagline = opt(raw.tagline)
  item.originallyAvailableAt = opt(raw.originallyAvailableAt)
  item.audienceRating = num(raw.audienceRating)

  const media = (raw.Media as Record<string, unknown>[] | undefined)?.map((m) => {
    const part = (m.Part as Record<string, unknown>[] | undefined)?.[0]
    return {
      videoResolution: opt(m.videoResolution),
      videoCodec: opt(m.videoCodec),
      audioCodec: opt(m.audioCodec),
      audioChannels: num(m.audioChannels),
      container: opt(m.container),
      bitrate: num(m.bitrate),
      width: num(m.width),
      height: num(m.height),
      size: part ? num(part.size) : undefined
    }
  })
  if (media?.length) item.media = media

  return item
}

/** Collections defined in a library section. */
export async function getCollections(
  serverId: string,
  sectionId: string
): Promise<PlexMediaItem[]> {
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/library/sections/${sectionId}/collections`,
    300
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/**
 * Every collection across the server's visible libraries, tagged with the
 * owning library's title (in `parentTitle`) so the UI can group/label them.
 */
export async function getAllCollections(serverId: string): Promise<PlexMediaItem[]> {
  const sections = (await getSections(serverId)).filter((s) => !s.hidden)
  const out: PlexMediaItem[] = []
  for (const section of sections) {
    const cols = await getCollections(serverId, section.key).catch(() => [])
    for (const c of cols) out.push({ ...c, parentTitle: section.title })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title))
}

/** Items inside a collection. */
export async function getCollectionItems(
  serverId: string,
  ratingKey: string
): Promise<PlexMediaItem[]> {
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/library/collections/${ratingKey}/children`,
    300
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/** A person's appearances within a section (filmography), via the actor filter. */
export async function getByActor(
  serverId: string,
  sectionId: string,
  actorId: string
): Promise<PlexMediaItem[]> {
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/library/sections/${sectionId}/all?actor=${encodeURIComponent(actorId)}&sort=year:desc`,
    200
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/** "More Like This" / related hubs for an item. */
export async function getRelated(serverId: string, ratingKey: string): Promise<PlexHub[]> {
  try {
    const data = await serverGetSized<Record<string, unknown>>(
      serverId,
      `/library/metadata/${ratingKey}/related?count=16`,
      16
    )
    return mapHubs(data)
  } catch {
    return [] // some servers/items don't support related; fail soft
  }
}

/** A subtitle Plex knows about that isn't embedded in the file (sidecar or
 * downloaded via OpenSubtitles); we side-load these into mpv. */
export interface ExternalSub {
  title: string
  lang?: string
  codec?: string
  url: string
}

export interface SubtitleSearchResult {
  key: string
  title: string
  lang?: string
  score?: number
}

/** Search OpenSubtitles (via the PMS subtitle agent) for an item. */
export async function searchSubtitles(
  serverId: string,
  ratingKey: string,
  lang: string
): Promise<SubtitleSearchResult[]> {
  const data = (await serverGet<unknown>(
    serverId,
    `/library/metadata/${ratingKey}/subtitles?language=${encodeURIComponent(lang)}`
  )) as { MediaContainer: { Stream?: Record<string, unknown>[] } }
  return (data.MediaContainer.Stream ?? [])
    .filter((s) => s.key) // provider results have a download key
    .map((s) => ({
      key: String(s.key),
      title: String(s.extendedDisplayTitle ?? s.displayTitle ?? s.providerTitle ?? 'Subtitle'),
      lang: optStr(s.language ?? s.languageCode),
      score: num(s.score)
    }))
}

/** Ask the PMS to download a searched subtitle (it becomes selected). */
export function downloadSubtitle(
  serverId: string,
  ratingKey: string,
  key: string
): Promise<Response> {
  return serverSend(
    serverId,
    'PUT',
    `/library/metadata/${ratingKey}/subtitles?key=${encodeURIComponent(key)}`
  )
}

/** Re-fetch the item's external subtitle streams (with selected flag). */
export async function getExternalSubs(
  serverId: string,
  ratingKey: string
): Promise<(ExternalSub & { selected: boolean })[]> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) return []
  const data = await serverGet<Record<string, unknown>>(serverId, `/library/metadata/${ratingKey}`)
  const raw = data.MediaContainer.Metadata?.[0]
  const part = ((raw?.Media as Record<string, unknown>[] | undefined)?.[0]?.Part as
    | Record<string, unknown>[]
    | undefined)?.[0]
  const streams = (part?.Stream as Record<string, unknown>[] | undefined) ?? []
  const base = server.bestConnection.uri
  return streams
    .filter((st) => num(st.streamType) === 3 && st.key)
    .map((st) => ({
      title: String(st.extendedDisplayTitle ?? st.displayTitle ?? st.language ?? 'Subtitle'),
      lang: optStr(st.languageCode ?? st.language),
      codec: optStr(st.codec),
      url: `${base}${String(st.key)}?X-Plex-Token=${encodeURIComponent(server.accessToken)}`,
      selected: st.selected === true || st.selected === 1 || st.selected === '1'
    }))
}

export interface PlaybackInfo {
  /** Direct-play stream URL (original file served by the PMS). */
  url: string
  title: string
  key: string
  type: string
  grandparentRatingKey?: string
  durationMs: number
  viewOffsetMs: number
  markers: { type: string; startTimeOffset: number; endTimeOffset: number }[]
  externalSubs: ExternalSub[]
}

/** Resolve everything needed to play an item directly with mpv. */
export async function getPlaybackInfo(
  serverId: string,
  ratingKey: string
): Promise<PlaybackInfo> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const data = await serverGet<Record<string, unknown>>(
    serverId,
    `/library/metadata/${ratingKey}?includeMarkers=1`
  )
  const raw = data.MediaContainer.Metadata?.[0]
  if (!raw) throw new Error('Item not found')
  const media = (raw.Media as Record<string, unknown>[] | undefined)?.[0]
  const part = (media?.Part as Record<string, unknown>[] | undefined)?.[0]
  if (!part?.key) throw new Error('No playable media part found')

  const base = server.bestConnection.uri
  const url = `${base}${String(part.key)}?X-Plex-Token=${encodeURIComponent(server.accessToken)}`
  const title = raw.grandparentTitle
    ? `${String(raw.grandparentTitle)} — ${String(raw.title)}`
    : String(raw.title ?? '')
  const markers = (raw.Marker as Record<string, unknown>[] | undefined)
    ?.map((m) => ({
      type: String(m.type ?? ''),
      startTimeOffset: num(m.startTimeOffset) ?? 0,
      endTimeOffset: num(m.endTimeOffset) ?? 0
    }))
    .filter((m) => m.endTimeOffset > m.startTimeOffset) ?? []

  // External subtitle streams (sidecar / OpenSubtitles-downloaded) have a
  // `key`; embedded ones don't and are handled by mpv directly.
  const streams = (part.Stream as Record<string, unknown>[] | undefined) ?? []
  const externalSubs: ExternalSub[] = streams
    .filter((st) => num(st.streamType) === 3 && st.key)
    .map((st) => ({
      title: String(st.extendedDisplayTitle ?? st.displayTitle ?? st.language ?? 'Subtitle'),
      lang: optStr(st.languageCode ?? st.language),
      codec: optStr(st.codec),
      url: `${base}${String(st.key)}?X-Plex-Token=${encodeURIComponent(server.accessToken)}`
    }))

  return {
    url,
    title,
    key: String(raw.key ?? `/library/metadata/${ratingKey}`),
    type: String(raw.type ?? ''),
    grandparentRatingKey: optStr(raw.grandparentRatingKey),
    durationMs: num(raw.duration) ?? 0,
    viewOffsetMs: num(raw.viewOffset) ?? 0,
    markers,
    externalSubs
  }
}

/** Find the previous/next episodes around `currentRatingKey` within a show. */
export async function getAdjacentEpisodes(
  serverId: string,
  showRatingKey: string,
  currentRatingKey: string
): Promise<{ prev: string | null; next: string | null; nextLabel: string | null }> {
  try {
    const data = await serverGet<Record<string, unknown>>(
      serverId,
      `/library/metadata/${showRatingKey}/allLeaves`
    )
    const eps = (data.MediaContainer.Metadata ?? []) as Record<string, unknown>[]
    const idx = eps.findIndex((e) => String(e.ratingKey) === String(currentRatingKey))
    if (idx >= 0) {
      const nextEp = idx + 1 < eps.length ? eps[idx + 1] : null
      const nextLabel = nextEp
        ? [
            nextEp.parentIndex != null && nextEp.index != null
              ? `S${nextEp.parentIndex} · E${nextEp.index}`
              : null,
            String(nextEp.title ?? '')
          ]
            .filter(Boolean)
            .join(' · ')
        : null
      return {
        prev: idx - 1 >= 0 ? String(eps[idx - 1].ratingKey) : null,
        next: nextEp ? String(nextEp.ratingKey) : null,
        nextLabel
      }
    }
  } catch {
    /* ignore */
  }
  return { prev: null, next: null, nextLabel: null }
}

/**
 * Build a Plex universal-transcode HLS URL at the chosen quality. mpv plays the
 * resulting m3u8; the PMS transcodes on demand (capped to maxBitrate).
 */
export async function buildTranscodeUrl(
  serverId: string,
  ratingKey: string,
  q: QualityOption,
  sessionId: string,
  surround = true
): Promise<string> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error('Server unreachable')
  const base = server.bestConnection.uri
  const params = new URLSearchParams({
    path: `/library/metadata/${ratingKey}`,
    mediaIndex: '0',
    partIndex: '0',
    protocol: 'hls',
    directPlay: '0',
    directStream: '1',
    fastSeek: '1',
    copyts: '1',
    maxVideoBitrate: String(q.maxBitrate ?? 20000),
    videoResolution: `${q.width ?? 1920}x${q.height ?? 1080}`,
    videoQuality: '100',
    audioBoost: '100',
    'X-Plex-Client-Identifier': getClientIdentifier(),
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Platform': 'Windows',
    'X-Plex-Token': server.accessToken,
    session: sessionId,
    'X-Plex-Session-Identifier': sessionId
  })

  // Preserve surround on transcoded streams: directStream copies the original
  // audio when it's HLS-compatible; if Plex MUST re-encode (e.g. DTS/TrueHD),
  // advertise AC3/E-AC3 as transcode targets and lift the channel cap to 7.1 so
  // it picks a multichannel codec instead of downmixing to stereo AAC.
  if (surround) {
    const profileExtra = [
      'add-transcode-target-audio-codec(type=videoProfile&context=streaming&protocol=hls&audioCodec=eac3)',
      'add-transcode-target-audio-codec(type=videoProfile&context=streaming&protocol=hls&audioCodec=ac3)',
      'add-limitation(scope=videoAudioCodec&scopeName=*&type=upperBound&name=audio.channels&value=8&isRequired=false)'
    ].join('+')
    params.set('X-Plex-Client-Profile-Extra', profileExtra)
  }

  return `${base}/video/:/transcode/universal/start.m3u8?${params.toString()}`
}

/** Tell the PMS to tear down a transcode session. */
export function stopTranscode(serverId: string, sessionId: string): Promise<void> {
  return serverHit(
    serverId,
    `/video/:/transcode/universal/stop?session=${encodeURIComponent(sessionId)}`
  ).catch(() => {})
}

/** Report playback timeline to the PMS (drives Now Playing + resume). */
export function reportTimeline(
  serverId: string,
  p: { ratingKey: string; key: string; state: string; timeMs: number; durationMs: number }
): Promise<void> {
  const params = new URLSearchParams({
    ratingKey: p.ratingKey,
    key: p.key,
    state: p.state,
    time: String(Math.floor(p.timeMs)),
    duration: String(Math.floor(p.durationMs)),
    identifier: 'com.plexapp.plugins.library'
  })
  return serverHit(serverId, `/:/timeline?${params.toString()}`).catch(() => {})
}

const SCROBBLE_AGENT = 'com.plexapp.plugins.library'

export function markPlayed(serverId: string, ratingKey: string): Promise<void> {
  return serverHit(serverId, `/:/scrobble?identifier=${SCROBBLE_AGENT}&key=${ratingKey}`)
}

export function markUnplayed(serverId: string, ratingKey: string): Promise<void> {
  return serverHit(serverId, `/:/unscrobble?identifier=${SCROBBLE_AGENT}&key=${ratingKey}`)
}

/** Report playback progress so resume + Continue Watching stay in sync. */
export function updateProgress(
  serverId: string,
  ratingKey: string,
  timeMs: number,
  state: 'playing' | 'paused' | 'stopped'
): Promise<void> {
  return serverHit(
    serverId,
    `/:/progress?identifier=${SCROBBLE_AGENT}&key=${ratingKey}&time=${Math.floor(timeMs)}&state=${state}`
  )
}

export async function getChildren(
  serverId: string,
  ratingKey: string
): Promise<PlexMediaItem[]> {
  const data = await serverGetCached<Record<string, unknown>>(
    serverId,
    `/library/metadata/${ratingKey}/children`
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/** All leaf items under a container (e.g. every episode of a show). */
export async function getAllLeaves(
  serverId: string,
  ratingKey: string
): Promise<PlexMediaItem[]> {
  // A single show's episode count is bounded; 2000 is well above any real show.
  const data = await serverGetSized<Record<string, unknown>>(
    serverId,
    `/library/metadata/${ratingKey}/allLeaves`,
    2000
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

// --- Playlists -------------------------------------------------------------

function mapPlaylist(raw: Record<string, unknown>): PlexPlaylist {
  return {
    ratingKey: String(raw.ratingKey ?? ''),
    key: String(raw.key ?? ''),
    title: String(raw.title ?? ''),
    summary: opt(raw.summary),
    smart: raw.smart === true || raw.smart === 1 || raw.smart === '1',
    playlistType: String(raw.playlistType ?? ''),
    leafCount: num(raw.leafCount),
    duration: num(raw.duration),
    thumb: opt(raw.thumb),
    composite: opt(raw.composite),
    addedAt: num(raw.addedAt),
    updatedAt: num(raw.updatedAt)
  }
}

export async function getPlaylists(serverId: string): Promise<PlexPlaylist[]> {
  const data = await serverGet<Record<string, unknown>>(serverId, '/playlists')
  return (data.MediaContainer.Metadata ?? []).map(mapPlaylist)
}

export async function getPlaylistItems(
  serverId: string,
  ratingKey: string
): Promise<PlexMediaItem[]> {
  const data = await serverGet<Record<string, unknown>>(
    serverId,
    `/playlists/${ratingKey}/items`
  )
  return (data.MediaContainer.Metadata ?? []).map(mapItem)
}

/** A server:// uri pointing at items on this server, for playlist ops. */
function itemsUri(machineId: string, ratingKeys: string[]): string {
  const keys = ratingKeys.join(',')
  return `server://${machineId}/com.plexapp.plugins.library/library/metadata/${keys}`
}

export async function createPlaylist(
  serverId: string,
  title: string,
  type: 'audio' | 'video' | 'photo',
  itemRatingKeys: string[]
): Promise<PlexPlaylist | null> {
  const server = await getServerById(serverId)
  const uri = itemsUri(server.clientIdentifier, itemRatingKeys)
  const params = new URLSearchParams({ title, type, smart: '0', uri })
  const res = await serverSend(serverId, 'POST', `/playlists?${params.toString()}`)
  const data = (await res.json()) as MediaContainer<Record<string, unknown>>
  const created = data.MediaContainer.Metadata?.[0]
  return created ? mapPlaylist(created) : null
}

export async function addToPlaylist(
  serverId: string,
  ratingKey: string,
  itemRatingKeys: string[]
): Promise<void> {
  const server = await getServerById(serverId)
  const uri = itemsUri(server.clientIdentifier, itemRatingKeys)
  const params = new URLSearchParams({ uri })
  await serverSend(serverId, 'PUT', `/playlists/${ratingKey}/items?${params.toString()}`)
}

export async function removePlaylistItem(
  serverId: string,
  ratingKey: string,
  playlistItemID: string
): Promise<void> {
  await serverSend(serverId, 'DELETE', `/playlists/${ratingKey}/items/${playlistItemID}`)
}

export async function deletePlaylist(serverId: string, ratingKey: string): Promise<void> {
  await serverSend(serverId, 'DELETE', `/playlists/${ratingKey}`)
}

/**
 * Copy a playlist (read with the admin token) into another user's account
 * (created with that user's token) — so only that user sees it.
 */
export async function copyPlaylistToUser(
  serverId: string,
  playlistRatingKey: string,
  userToken: string
): Promise<{ ratingKey: string; title: string; type: string; itemKeys: string[] }> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error(`Server ${server.name} is unreachable`)
  const base = server.bestConnection.uri

  const meta = await serverGet<Record<string, unknown>>(serverId, `/playlists/${playlistRatingKey}`)
  const pl = meta.MediaContainer.Metadata?.[0]
  const title = String(pl?.title ?? 'Shared Playlist')
  const type = String(pl?.playlistType ?? 'video')

  const itemsData = await serverGet<Record<string, unknown>>(
    serverId,
    `/playlists/${playlistRatingKey}/items`
  )
  const keys = (itemsData.MediaContainer.Metadata ?? []).map((m) => String(m.ratingKey))
  if (keys.length === 0) throw new Error('That playlist is empty')

  const uri = `server://${server.clientIdentifier}/com.plexapp.plugins.library/library/metadata/${keys.join(',')}`
  const params = new URLSearchParams({ title, type, smart: '0', uri })
  // Create in the target user's account using THEIR token.
  const res = await fetch(`${base}/playlists?${params.toString()}`, {
    method: 'POST',
    headers: plexHeaders(userToken)
  })
  if (!res.ok) throw new Error(`Failed to create the playlist for that user (${res.status})`)
  const created = (await res.json().catch(() => null)) as MediaContainer<
    Record<string, unknown>
  > | null
  const ratingKey = String(created?.MediaContainer?.Metadata?.[0]?.ratingKey ?? '')
  // Without the new playlist's ratingKey we can't track it for sync — fail
  // rather than register a broken member that errors on every reconcile.
  if (!ratingKey) throw new Error('Playlist was created but its id could not be read')
  return { ratingKey, title, type, itemKeys: keys }
}
