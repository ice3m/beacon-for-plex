import { app, protocol } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PLEX_IMG_SCHEME } from '@shared/ipc'
import { plexHeaders } from './headers'
import { getServerById } from './servers'

/**
 * Must run BEFORE app.whenReady(). Marks the artwork scheme as privileged so
 * the renderer can <img src="plex-img://…"> it under CSP and via fetch.
 */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PLEX_IMG_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

function cacheDir(): string {
  const dir = join(app.getPath('userData'), 'image-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Stable on-disk path for a (server, artwork, size) triple. */
export function imageCacheFile(
  serverId: string,
  path: string,
  w?: string | number | null,
  h?: string | number | null
): string {
  const key = createHash('sha1')
    .update(`${serverId}|${path}|${w ?? ''}|${h ?? ''}`)
    .digest('hex')
  return join(cacheDir(), key)
}

function sniffContentType(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return 'image/jpeg'
}

/** Fetch artwork bytes from the server (transcoded to size when requested). */
async function fetchImageBytes(
  serverId: string,
  path: string,
  w?: string | number | null,
  h?: string | number | null
): Promise<Buffer> {
  const server = await getServerById(serverId)
  if (!server.bestConnection) throw new Error('Server unreachable')
  const base = server.bestConnection.uri
  // Use Plex's photo transcoder when a size is requested (smaller, faster).
  const target =
    w || h
      ? `${base}/photo/:/transcode?minSize=1&upscale=1&width=${w ?? h}&height=${h ?? w}&url=${encodeURIComponent(path)}`
      : `${base}${path}`
  const res = await fetch(target, { headers: plexHeaders(server.accessToken) })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Ensure a (server, artwork, size) image is on disk. Returns 'skipped' if it
 * was already cached, 'cached' if freshly downloaded, 'error' on failure.
 * Used by the full-database prewarm to populate the same cache the UI reads.
 */
export async function ensureImageCached(
  serverId: string,
  path: string,
  w?: number | null,
  h?: number | null
): Promise<'cached' | 'skipped' | 'error'> {
  const file = imageCacheFile(serverId, path, w, h)
  if (existsSync(file)) return 'skipped'
  try {
    const buf = await fetchImageBytes(serverId, path, w, h)
    await writeFile(file, buf)
    return 'cached'
  } catch {
    return 'error'
  }
}

/**
 * Register the handler that resolves plex-img:// URLs against a server's
 * connection + token, transcodes to the requested size, and caches bytes on
 * disk so subsequent loads are instant and offline-friendly.
 */
export function registerImageProtocol(): void {
  protocol.handle(PLEX_IMG_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const serverId = url.searchParams.get('server')
      const path = url.searchParams.get('path')
      const w = url.searchParams.get('w')
      const h = url.searchParams.get('h')
      if (!serverId || !path) return new Response('bad request', { status: 400 })

      const cacheFile = imageCacheFile(serverId, path, w, h)
      if (existsSync(cacheFile)) {
        const cached = await readFile(cacheFile)
        return new Response(cached, {
          headers: { 'Content-Type': sniffContentType(cached), 'Cache-Control': 'max-age=31536000' }
        })
      }

      const buf = await fetchImageBytes(serverId, path, w, h)
      // Best-effort cache write; never fail the request on a write error.
      void writeFile(cacheFile, buf).catch(() => {})
      return new Response(buf, {
        headers: { 'Content-Type': sniffContentType(buf), 'Cache-Control': 'max-age=31536000' }
      })
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}
