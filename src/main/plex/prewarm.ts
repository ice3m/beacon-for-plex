import type { CacheProgress, PlexMediaItem } from '@shared/types'
import { ensureImageCached } from './images'
import {
  getAllLeaves,
  getChildren,
  getMetadata,
  getSectionContents,
  getSections
} from './client'

/**
 * Full-database prewarm: walk every library and download all artwork into the
 * on-disk image cache (the same cache the UI reads), so browsing is instant.
 *
 * Two phases:
 *   1. Scan — page through every item (and, for shows, every episode; for
 *      music, every album) and build a de-duplicated list of image jobs.
 *   2. Cache — download each missing image, skipping any already on disk.
 *
 * Already-cached images are skipped, so re-running only fetches NEW artwork —
 * this is the "catch up on recently added" path. Live browsing already pulls
 * uncached images on demand and refreshes metadata (stale-while-revalidate),
 * so new content is never missed regardless of when this was last run.
 */

const PAGE = 200
const CONCURRENCY = 8

// Artwork sizes the UI requests, by role — caching these exact keys means the
// renderer's later <img> loads hit disk. (Keep in sync with imageUrl() calls.)
const POSTER_SIZES: [number, number][] = [
  [300, 450], // MediaCard grid poster
  [96, 144], // LibraryView list-row thumb
  [360, 540] // DetailView poster
]
const ART_SIZES: [number, number][] = [[1280, 720]] // DetailView hero
const EPISODE_SIZES: [number, number][] = [[400, 225]] // landscape still

interface Job {
  path: string
  w: number
  h: number
}

let status: CacheProgress = {
  running: false,
  phase: 'Idle',
  done: 0,
  total: 0,
  cached: 0,
  skipped: 0,
  errors: 0
}
let cancelRequested = false
let onStatus: ((s: CacheProgress) => void) | null = null

function emit(): void {
  onStatus?.({ ...status })
}

function setPhase(phase: string, currentLibrary?: string): void {
  status = { ...status, phase, currentLibrary }
  emit()
}

export function getPrewarmStatus(): CacheProgress {
  return { ...status }
}

export function cancelPrewarm(): CacheProgress {
  if (status.running) {
    cancelRequested = true
    setPhase('Cancelling…')
  }
  return { ...status }
}

/** Add image jobs for one item into the dedup map. */
function addItemJobs(jobs: Map<string, Job>, item: PlexMediaItem): void {
  const add = (path: string | undefined, sizes: [number, number][]): void => {
    if (!path) return
    for (const [w, h] of sizes) {
      jobs.set(`${path}|${w}|${h}`, { path, w, h })
    }
  }
  if (item.type === 'episode') {
    add(item.thumb, EPISODE_SIZES)
    add(item.parentThumb, POSTER_SIZES) // season poster
  } else {
    add(item.thumb, POSTER_SIZES)
    add(item.art, ART_SIZES)
  }
}

/** Page through a whole section, returning every top-level item. */
async function readSectionItems(serverId: string, sectionId: string): Promise<PlexMediaItem[]> {
  const out: PlexMediaItem[] = []
  let start = 0
  for (;;) {
    if (cancelRequested) break
    const page = await getSectionContents(serverId, sectionId, { start, size: PAGE })
    out.push(...page.items)
    start += page.items.length
    if (page.items.length < PAGE || start >= (page.totalSize || start)) break
  }
  return out
}

/** Run jobs with bounded concurrency, updating progress as they complete. */
async function runJobs(serverId: string, jobs: Job[]): Promise<void> {
  let next = 0
  let lastEmit = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      if (cancelRequested) return
      const i = next++
      if (i >= jobs.length) return
      const job = jobs[i]
      const result = await ensureImageCached(serverId, job.path, job.w, job.h)
      status.done++
      if (result === 'cached') status.cached++
      else if (result === 'skipped') status.skipped++
      else status.errors++
      const now = Date.now()
      if (now - lastEmit > 300 || status.done === jobs.length) {
        lastEmit = now
        emit()
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length || 1) }, worker))
}

/** Warm metadata JSON (item detail + show season lists) into the disk cache. */
async function warmDetails(
  serverId: string,
  metaKeys: string[],
  childKeys: string[]
): Promise<void> {
  const tasks: (() => Promise<unknown>)[] = [
    ...metaKeys.map((k) => () => getMetadata(serverId, k).catch(() => null)),
    ...childKeys.map((k) => () => getChildren(serverId, k).catch(() => []))
  ]
  let next = 0
  let lastEmit = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      if (cancelRequested) return
      const i = next++
      if (i >= tasks.length) return
      await tasks[i]()
      status.done++
      const now = Date.now()
      if (now - lastEmit > 300 || status.done === status.total) {
        lastEmit = now
        emit()
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length || 1) }, worker))
}

/**
 * Begin a full prewarm for a server. Returns immediately with the initial
 * status; progress streams via the onStatus callback. No-op (returns current
 * status) if a scan is already running.
 */
export function startPrewarm(serverId: string, push: (s: CacheProgress) => void): CacheProgress {
  if (status.running) return { ...status }
  onStatus = push
  cancelRequested = false
  status = {
    running: true,
    phase: 'Starting…',
    done: 0,
    total: 0,
    cached: 0,
    skipped: 0,
    errors: 0
  }
  emit()

  void run(serverId)
  return { ...status }
}

async function run(serverId: string): Promise<void> {
  try {
    const sections = await getSections(serverId)
    const jobs = new Map<string, Job>()
    // Metadata to warm: every top-level item's detail + each show's season list.
    const detailKeys = new Set<string>()
    const childKeys = new Set<string>()

    // --- Phase 1: scan ---
    for (const section of sections) {
      if (cancelRequested) break
      if (section.type === 'photo') continue // photo libraries: skip (huge, low value)
      setPhase(`Scanning ${section.title}…`, section.title)

      const items = await readSectionItems(serverId, section.key)
      for (const item of items) {
        addItemJobs(jobs, item)
        detailKeys.add(item.ratingKey)
      }

      // Descend for the artwork the grid view doesn't surface directly.
      if (section.type === 'show') {
        for (const show of items) {
          if (cancelRequested) break
          childKeys.add(show.ratingKey)
          const episodes = await getAllLeaves(serverId, show.ratingKey).catch(() => [])
          for (const ep of episodes) addItemJobs(jobs, ep)
        }
      } else if (section.type === 'artist') {
        for (const artist of items) {
          if (cancelRequested) break
          const albums = await getChildren(serverId, artist.ratingKey).catch(() => [])
          for (const album of albums) addItemJobs(jobs, album)
        }
      }
      status.total = jobs.size
      emit()
    }

    if (cancelRequested) {
      status = { ...status, running: false, phase: 'Cancelled' }
      emit()
      return
    }

    // --- Phase 2: cache artwork, then warm metadata ---
    const jobList = [...jobs.values()]
    const metaKeys = [...detailKeys]
    const childList = [...childKeys]
    status.total = jobList.length + metaKeys.length + childList.length
    setPhase('Caching artwork…')
    await runJobs(serverId, jobList)

    if (!cancelRequested) {
      setPhase('Caching details…')
      await warmDetails(serverId, metaKeys, childList)
    }

    status = {
      ...status,
      running: false,
      phase: cancelRequested ? 'Cancelled' : 'Done',
      currentLibrary: undefined
    }
    emit()
  } catch (err) {
    status = {
      ...status,
      running: false,
      phase: `Error: ${err instanceof Error ? err.message : 'failed'}`
    }
    emit()
  } finally {
    // Release the progress callback so a stale closure isn't retained between runs.
    onStatus = null
  }
}
