import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** Total byte size of a directory's immediate files (caches are flat). */
function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const name of readdirSync(dir)) {
    try {
      const s = statSync(join(dir, name))
      if (s.isFile()) total += s.size
    } catch {
      /* ignore */
    }
  }
  return total
}

function imageDir(): string {
  return join(app.getPath('userData'), 'image-cache')
}
function metaDir(): string {
  return join(app.getPath('userData'), 'meta-cache')
}

export interface CacheSizes {
  /** Bytes used by cached artwork. */
  images: number
  /** Bytes used by cached metadata JSON. */
  metadata: number
}

export function getCacheSizes(): CacheSizes {
  return { images: dirSize(imageDir()), metadata: dirSize(metaDir()) }
}

/** Delete all cached artwork + metadata. Returns the freed sizes (pre-clear). */
export function clearCaches(): CacheSizes {
  const before = getCacheSizes()
  for (const dir of [imageDir(), metaDir()]) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      try {
        rmSync(join(dir, name), { force: true })
      } catch {
        /* ignore */
      }
    }
  }
  return before
}
