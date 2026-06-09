import { app } from 'electron'
import { getClientIdentifier } from '../store'

/** Product identity Plex shows in the user's "authorized devices" list. */
export const PLEX_PRODUCT = 'Plex Desktop (Custom)'
export const PLEX_DEVICE = 'Desktop'

/**
 * Standard X-Plex-* headers sent on every plex.tv / server request.
 * `Accept: application/json` makes plex.tv return JSON instead of XML.
 */
export function plexHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Version': app.getVersion(),
    'X-Plex-Client-Identifier': getClientIdentifier(),
    'X-Plex-Device': PLEX_DEVICE,
    'X-Plex-Device-Name': PLEX_PRODUCT,
    'X-Plex-Platform': process.platform,
    'X-Plex-Platform-Version': process.getSystemVersion()
  }
  if (token) headers['X-Plex-Token'] = token
  return headers
}
