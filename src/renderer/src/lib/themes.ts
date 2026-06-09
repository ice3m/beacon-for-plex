/**
 * Client-side themes. Each theme is a set of RGB triples mapped onto the CSS
 * variables the whole UI reads (see styles.css / tailwind.config.js), so
 * switching is instant and recolors everything.
 */
export interface Theme {
  id: string
  name: string
  vars: {
    accent: string
    surface: string
    surfaceRaised: string
    ink: string
    inkMuted: string
  }
}

export const THEMES: Theme[] = [
  {
    id: 'plex',
    name: 'Plex',
    // Official Plex brand gold (#E5A00D) on near-black, matching plex.tv.
    vars: { accent: '229 160 13', surface: '8 8 8', surfaceRaised: '26 26 26', ink: '238 238 238', inkMuted: '153 153 153' }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: { accent: '56 132 255', surface: '8 11 20', surfaceRaised: '18 24 40', ink: '236 240 248', inkMuted: '138 150 175' }
  },
  {
    id: 'emerald',
    name: 'Emerald',
    vars: { accent: '16 185 129', surface: '8 14 12', surfaceRaised: '18 30 26', ink: '236 245 240', inkMuted: '135 160 150' }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    vars: { accent: '249 115 22', surface: '18 10 12', surfaceRaised: '34 20 22', ink: '250 240 238', inkMuted: '175 145 140' }
  },
  {
    id: 'royal',
    name: 'Royal',
    vars: { accent: '139 92 246', surface: '13 10 22', surfaceRaised: '26 21 42', ink: '240 238 250', inkMuted: '155 148 180' }
  },
  {
    id: 'aurora',
    name: 'Aurora',
    vars: { accent: '45 212 191', surface: '9 16 20', surfaceRaised: '18 32 38', ink: '232 245 245', inkMuted: '130 162 165' }
  },
  {
    id: 'rose',
    name: 'Rosé',
    vars: { accent: '244 63 94', surface: '17 10 13', surfaceRaised: '32 20 25', ink: '250 238 242', inkMuted: '180 145 155' }
  },
  {
    id: 'mono',
    name: 'Mono',
    vars: { accent: '180 184 200', surface: '12 12 14', surfaceRaised: '26 26 30', ink: '240 240 244', inkMuted: '150 150 158' }
  }
]

export const DEFAULT_THEME_ID = 'plex'
const STORAGE_KEY = 'plex-desktop-theme'

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

/** Apply a theme's variables to :root and persist the choice. */
export function applyTheme(id: string, persist = true): void {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  const root = document.documentElement
  root.style.setProperty('--accent', theme.vars.accent)
  root.style.setProperty('--surface', theme.vars.surface)
  root.style.setProperty('--surface-raised', theme.vars.surfaceRaised)
  root.style.setProperty('--ink', theme.vars.ink)
  root.style.setProperty('--ink-muted', theme.vars.inkMuted)
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme.id)
    } catch {
      /* ignore storage errors */
    }
  }
}
