import type { ReactNode } from 'react'

/**
 * Flat, single-stroke line icons (Plex-style). Each entry is the inner SVG
 * content; the wrapper supplies a 24x24 viewBox and currentColor stroke, so
 * icons are crisp at any size and recolor with the active theme.
 */
const PATHS: Record<string, ReactNode> = {
  // --- App / nav ---
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
    </>
  ),
  playlists: (
    <>
      <path d="M4 7h12M4 12h12M4 17h8" />
      <path d="M16.5 15.3l4.2 2.3-4.2 2.3z" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M19 7h1" />
      <circle cx="15.5" cy="7" r="2.2" />
      <path d="M4 17h1M11 17h9" />
      <circle cx="7.5" cy="17" r="2.2" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M6.5 7.5h.01M6.5 16.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" />
    </>
  ),
  collections: (
    <>
      <rect x="3" y="7" width="13" height="13" rx="1.5" />
      <path d="M7 4h11a1.5 1.5 0 0 1 1.5 1.5V16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M6 5l10 7-10 7z" fill="currentColor" stroke="none" />
      <rect x="17" y="5" width="2.6" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M18 5l-10 7 10 7z" fill="currentColor" stroke="none" />
      <rect x="4.4" y="5" width="2.6" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  pip: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="11.5" y="11" width="7.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  back10: (
    <>
      <path d="M3.6 13a8.4 8.4 0 1 0 2.2-6.2" />
      <path d="M5 3v4.2h4.2" />
      <text x="12.5" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">
        10
      </text>
    </>
  ),
  forward30: (
    <>
      <path d="M20.4 13a8.4 8.4 0 1 1-2.2-6.2" />
      <path d="M19 3v4.2h-4.2" />
      <text x="11.5" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">
        30
      </text>
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),

  // --- Library base types ---
  tv: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  film: (
    <>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
      <path d="M7.5 5v14M16.5 5v14" />
      <path d="M2.75 9.5h4.75M2.75 14.5h4.75M16.5 9.5h4.75M16.5 14.5h4.75" />
    </>
  ),
  music: (
    <>
      <path d="M9 17V6l10-2v9" />
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="16.5" cy="15" r="2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,

  // --- Requested custom library icons ---
  anime: (
    // Torii gate
    <>
      <path d="M3.5 7h17" />
      <path d="M5.5 10.5h13" />
      <path d="M7 7v13M17 7v13" />
    </>
  ),
  audiobook: (
    // Open book with a headphone band
    <>
      <path d="M12 9v10" />
      <path d="M12 9C10.2 8.1 7 8.1 5 9v10c2-.9 5.2-.9 7 0" />
      <path d="M12 9c1.8-.9 5-.9 7 0v10c-2-.9-5.2-.9-7 0" />
      <path d="M8.5 7.5a3.5 3.5 0 0 1 7 0" />
    </>
  ),
  uhd: (
    // Screen with a 4K badge
    <>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
      <text
        x="12"
        y="14.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        4K
      </text>
    </>
  ),
  kidsTv: (
    // Monitor with a sparkle
    <>
      <rect x="3" y="6.5" width="18" height="11.5" rx="2" />
      <path d="M8.5 21.5h7M12 18v3.5" />
      <path d="M18 2.5l.75 1.75L20.5 5l-1.75.75L18 7.5l-.75-1.75L15.5 5l1.75-.75z" fill="currentColor" stroke="none" />
    </>
  ),
  kidsMovie: (
    // Filmstrip with a sparkle
    <>
      <rect x="2.75" y="7" width="18.5" height="13" rx="2" />
      <path d="M7.5 7v13M16.5 7v13" />
      <path d="M2.75 11h4.75M2.75 16h4.75M16.5 11h4.75M16.5 16h4.75" />
      <path d="M18 1.5l.75 1.75L20.5 4l-1.75.75L18 6.5l-.75-1.75L15.5 4l1.75-.75z" fill="currentColor" stroke="none" />
    </>
  ),

  // --- Extra fun choices ---
  star: (
    <path
      d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.65l5.9-.85z"
      fill="currentColor"
      stroke="none"
    />
  ),
  heart: <path d="M12 20s-7-4.5-9-9C1.6 7 4 4 7 4c2 0 3.3 1.2 5 3 1.7-1.8 3-3 5-3 3 0 5.4 3 4 7-2 4.5-9 9-9 9z" />,
  ghost: (
    <>
      <path d="M5 20v-8a7 7 0 0 1 14 0v8l-2.3-1.6L14.3 20 12 18.3 9.7 20l-2.4-1.6z" />
      <circle cx="9.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c3 2 4.5 5 4.5 9l-2 4h-5l-2-4C7.5 8 9 5 12 3z" />
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M9.5 16l-2 4 3.5-1.8M14.5 16l2 4-3.5-1.8" />
    </>
  ),
  gamepad: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="4.5" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-3.5L7 20z" />
}

/** Library choices shown in the icon picker (ordered for relevance). */
export const LIBRARY_ICON_CHOICES: { id: string; label: string }[] = [
  { id: 'tv', label: 'TV' },
  { id: 'film', label: 'Movies' },
  { id: 'uhd', label: 'UHD / 4K' },
  { id: 'anime', label: 'Anime' },
  { id: 'kidsTv', label: 'Kids Shows' },
  { id: 'kidsMovie', label: 'Kids Movies' },
  { id: 'music', label: 'Music' },
  { id: 'audiobook', label: 'Audiobooks' },
  { id: 'camera', label: 'Photos' },
  { id: 'gamepad', label: 'Games' },
  { id: 'ghost', label: 'Horror' },
  { id: 'rocket', label: 'Sci-Fi' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Favorites' },
  { id: 'globe', label: 'World' },
  { id: 'folder', label: 'Generic' }
]

export function defaultLibraryIconId(type: string): string {
  switch (type) {
    case 'movie':
      return 'film'
    case 'show':
      return 'tv'
    case 'artist':
      return 'music'
    case 'photo':
      return 'camera'
    default:
      return 'folder'
  }
}

/** Render a named flat icon. */
export function Icon({
  name,
  className = 'h-5 w-5'
}: {
  name: string
  className?: string
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name] ?? PATHS.folder}
    </svg>
  )
}

/**
 * Resolve a library's glyph: a chosen flat-icon id, else the default for its
 * type. A legacy/custom value that isn't a known icon id renders as text
 * (e.g. an emoji), preserving older custom icons.
 */
export function LibraryGlyph({
  iconId,
  type,
  className = 'h-5 w-5'
}: {
  iconId?: string | null
  type: string
  className?: string
}): JSX.Element {
  if (iconId && !(iconId in PATHS)) {
    return (
      <span className={`inline-flex items-center justify-center text-base leading-none ${className}`}>
        {iconId}
      </span>
    )
  }
  const name = iconId && iconId in PATHS ? iconId : defaultLibraryIconId(type)
  return <Icon name={name} className={className} />
}
