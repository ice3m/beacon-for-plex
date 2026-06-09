import type { PlexApi } from '@shared/types'

declare global {
  interface Window {
    plex: PlexApi
  }
}

export {}
