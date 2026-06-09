import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * On-disk JSON cache for metadata responses. Used as a network-first fallback:
 * client functions fetch live and write-through here, then fall back to the
 * cached copy when the server is unreachable — so detail/season pages (and any
 * item warmed by the full-database prewarm) open instantly offline.
 */
export function metaCacheDir(): string {
  const dir = join(app.getPath('userData'), 'meta-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function cacheFile(serverId: string, path: string): string {
  const key = createHash('sha1').update(`${serverId}|${path}`).digest('hex')
  return join(metaCacheDir(), `${key}.json`)
}

export async function readMetaCache<T>(serverId: string, path: string): Promise<T | null> {
  const file = cacheFile(serverId, path)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as T
  } catch {
    return null
  }
}

export async function writeMetaCache(serverId: string, path: string, data: unknown): Promise<void> {
  try {
    await writeFile(cacheFile(serverId, path), JSON.stringify(data))
  } catch {
    /* best-effort */
  }
}
