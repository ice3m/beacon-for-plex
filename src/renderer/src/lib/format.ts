/** Human-friendly helpers for Plex metadata. */

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return ''
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Resume progress as a 0–100 percentage, or null when not started. */
export function progressPercent(viewOffset?: number, duration?: number): number | null {
  if (!viewOffset || !duration) return null
  return Math.min(100, Math.round((viewOffset / duration) * 100))
}

/** A concise subtitle for a card based on its type. */
export function itemSubtitle(item: {
  type: string
  year?: number
  parentTitle?: string
  grandparentTitle?: string
  index?: number
  parentIndex?: number
  leafCount?: number
}): string {
  switch (item.type) {
    case 'episode':
      return item.parentIndex != null && item.index != null
        ? `S${item.parentIndex} · E${item.index}`
        : (item.grandparentTitle ?? '')
    case 'season':
      return item.leafCount ? `${item.leafCount} episodes` : ''
    case 'show':
      return item.leafCount ? `${item.leafCount} episodes` : (item.year ? String(item.year) : '')
    case 'album':
      return item.parentTitle ?? (item.year ? String(item.year) : '')
    case 'track':
      return item.grandparentTitle ?? item.parentTitle ?? ''
    default:
      return item.year ? String(item.year) : ''
  }
}

/** Whether a type is best shown as a portrait poster vs. landscape art. */
export function isPortrait(type: string): boolean {
  return type !== 'episode' && type !== 'clip'
}

/** Human-readable file size. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

/** Format an ISO-ish date string (YYYY-MM-DD) as a readable date. */
export function formatDate(s?: string): string {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const month = months[Number(m[2]) - 1] ?? ''
  return `${month} ${Number(m[3])}, ${m[1]}`
}

/** Pretty resolution label (e.g. "1080p" → "1080p", "4k" → "4K"). */
export function formatResolution(r?: string): string {
  if (!r) return ''
  if (r.toLowerCase() === 'sd') return 'SD'
  if (r.toLowerCase() === '4k') return '4K'
  return /^\d+$/.test(r) ? `${r}p` : r
}

/** Plex numeric metadata type for a library's top-level items. */
export function sectionTypeNumber(type: string): number {
  switch (type) {
    case 'movie':
      return 1
    case 'show':
      return 2
    case 'artist':
      return 8
    case 'photo':
      return 13
    default:
      return 1
  }
}
