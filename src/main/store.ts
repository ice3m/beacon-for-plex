import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import type { PlexAccount, WatchlistEntry } from '@shared/types'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Tiny JSON-file store living in userData. The auth token is encrypted at rest
 * with the OS keychain via safeStorage; everything else is plain config.
 */
interface PersistedState {
  clientIdentifier: string
  /** base64 of safeStorage-encrypted token, or null when logged out. */
  encryptedToken: string | null
  /** machineIdentifier of the server the user last selected. */
  selectedServerId: string | null
  /** Client-side custom library icons, keyed by section id. */
  libraryIcons: Record<string, string>
  /** Section ids hidden from the sidebar. */
  hiddenLibraries: string[]
  /** User-defined order of section ids for the sidebar. */
  libraryOrder: string[]
  /** Server account ids hidden from the Recently Watched user dropdown. */
  hiddenHistoryUsers?: number[]
  /** Last normal (un-maximized) window size/position, restored on next launch. */
  windowBounds?: { width: number; height: number; x?: number; y?: number }
  /** Whether the window was maximized when last closed. */
  windowMaximized?: boolean
  /** Whether the window was fullscreen when last closed. */
  windowFullScreen?: boolean
  /** Playback preferences applied when starting mpv. */
  playbackPrefs?: PlaybackPrefs
  /** Last volume (0–130), restored on next playback. */
  lastVolume?: number
  /** Last playback speed + subtitle scale, restored on next playback. */
  lastSpeed?: number
  lastSubScale?: number
  /** Last signed-in account, for offline/transient-failure resilience. */
  lastAccount?: PlexAccount
  /** Playlists kept in two-way sync between the admin and Home users. */
  syncedPlaylists?: SyncedPlaylistGroup[]
  /** Cached Home-user access tokens (base64 encrypted), keyed by uuid. */
  homeUserTokens?: Record<string, string>
  /** Personal watchlist per server (machineIdentifier → newest-first entries). */
  watchlist?: Record<string, WatchlistEntry[]>
  /** Remembered audio/subtitle choices per show (or movie) ratingKey. */
  showPrefs?: Record<string, ShowMediaPref>
  /** App version last launched — drives the one-time "What's New" dialog. */
  lastSeenVersion?: string
}

/** Per-show (or per-movie) remembered track choices, applied on next playback. */
export interface ShowMediaPref {
  audioLang?: string
  subtitleLang?: string
  subtitlesOn?: boolean
}

/** Internal store shape for a synced playlist group (see SyncedPlaylist). */
export interface SyncedPlaylistGroup {
  serverId: string
  adminRatingKey: string
  title: string
  type: string
  /** Item ratingKeys at the last successful reconcile (shared baseline). */
  baseline: string[]
  members: { userUuid: string; userTitle: string; ratingKey: string; needsAuth?: boolean }[]
  updatedAt: number
  lastSyncedAt?: number
  lastError?: string
}

export interface PlaybackPrefs {
  /** Preferred audio language(s), ISO-639 (comma list), e.g. "eng,jpn". */
  audioLang: string
  /** Preferred subtitle language(s). */
  subtitleLang: string
  /** Show subtitles by default. */
  subtitlesOn: boolean
  /** Preserve original channel layout (surround) vs. downmix to stereo. */
  surround: boolean
  autoSkipIntro: boolean
  autoSkipCredits: boolean
  autoPlayNext: boolean
  /** Advertise this app as a Plex player so phones can cast to it. */
  advertiseAsPlayer: boolean
  /** Default streaming quality preset id. */
  defaultQuality: string
  /** Hide to the system tray (instead of quitting) when the window is closed. */
  minimizeToTray: boolean
}

const DEFAULT_PLAYBACK_PREFS: PlaybackPrefs = {
  audioLang: 'eng',
  subtitleLang: 'eng',
  subtitlesOn: false,
  surround: true,
  autoSkipIntro: true,
  autoSkipCredits: false,
  autoPlayNext: true,
  advertiseAsPlayer: false,
  defaultQuality: 'original',
  minimizeToTray: false
}

const STORE_FILE = 'plex-desktop.json'

let cache: PersistedState | null = null

function storePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, STORE_FILE)
}

function load(): PersistedState {
  if (cache) return cache
  const path = storePath()
  if (existsSync(path)) {
    try {
      cache = JSON.parse(readFileSync(path, 'utf-8')) as PersistedState
    } catch {
      cache = null
    }
  }
  if (!cache || !cache.clientIdentifier) {
    cache = {
      clientIdentifier: cache?.clientIdentifier ?? randomUUID(),
      encryptedToken: cache?.encryptedToken ?? null,
      selectedServerId: cache?.selectedServerId ?? null,
      libraryIcons: cache?.libraryIcons ?? {},
      hiddenLibraries: cache?.hiddenLibraries ?? [],
      libraryOrder: cache?.libraryOrder ?? []
    }
    persist()
  }
  // Backfill fields added in later versions.
  if (!cache.libraryIcons) cache.libraryIcons = {}
  if (!cache.hiddenLibraries) cache.hiddenLibraries = []
  if (!cache.libraryOrder) cache.libraryOrder = []
  if (cache.selectedServerId === undefined) cache.selectedServerId = null
  return cache
}

function persist(): void {
  if (!cache) return
  // Atomic write: serialize to a temp file then rename over the target, so a
  // crash or concurrent read never sees a half-written (corrupt) store.
  const path = storePath()
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf-8')
  renameSync(tmp, path)
}

/** Stable per-install identifier Plex uses to recognize this client. */
export function getClientIdentifier(): string {
  return load().clientIdentifier
}

// When the OS keychain (DPAPI/Keychain/libsecret) is unavailable, we refuse to
// write tokens to disk in plaintext. The main account token is then kept in
// memory for the session; cached Home-user tokens simply aren't stored.
let memoryToken: string | null = null

/** Encrypt to base64 via the OS keychain, or null if unavailable (never plaintext). */
function encryptOrNull(token: string): string | null {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token).toString('base64')
    : null
}

/** Decrypt a base64 token produced by encryptOrNull (null on failure/unavailable). */
function decryptOrNull(encrypted: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (err) {
    console.error('[store] token decrypt FAILED:', (err as Error).message)
    return null
  }
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken
  const state = load()
  return state.encryptedToken ? decryptOrNull(state.encryptedToken) : null
}

export function setToken(token: string | null): void {
  const state = load()
  if (token === null) {
    memoryToken = null
    state.encryptedToken = null
    persist()
    return
  }
  const enc = encryptOrNull(token)
  if (enc) {
    memoryToken = null
    state.encryptedToken = enc
  } else {
    // Secure storage missing — hold the token in memory only, never on disk.
    console.warn('[store] OS secure storage unavailable; keeping token in memory only (re-login required next launch).')
    memoryToken = token
    state.encryptedToken = null
  }
  persist()
}

export function getSelectedServerId(): string | null {
  return load().selectedServerId
}

export function setSelectedServerId(serverId: string | null): void {
  load().selectedServerId = serverId
  persist()
}

export function getLibraryIcons(): Record<string, string> {
  return { ...load().libraryIcons }
}

export function setLibraryIcon(sectionId: string, icon: string | null): void {
  const state = load()
  if (icon === null || icon === '') {
    delete state.libraryIcons[sectionId]
  } else {
    state.libraryIcons[sectionId] = icon
  }
  persist()
}

export function getHiddenLibraries(): string[] {
  return [...load().hiddenLibraries]
}

export function getLibraryOrder(): string[] {
  return [...load().libraryOrder]
}

export function setLibraryOrder(orderedIds: string[]): void {
  load().libraryOrder = [...orderedIds]
  persist()
}

export function getWindowBounds(): PersistedState['windowBounds'] {
  return load().windowBounds
}

export function setWindowBounds(bounds: PersistedState['windowBounds']): void {
  load().windowBounds = bounds
  persist()
}

export function getWindowFlags(): { maximized: boolean; fullscreen: boolean } {
  const s = load()
  return { maximized: s.windowMaximized ?? false, fullscreen: s.windowFullScreen ?? false }
}

export function setWindowFlags(flags: { maximized?: boolean; fullscreen?: boolean }): void {
  const s = load()
  if (flags.maximized !== undefined) s.windowMaximized = flags.maximized
  if (flags.fullscreen !== undefined) s.windowFullScreen = flags.fullscreen
  persist()
}

/** App version last launched (null on first-ever run). */
export function getLastSeenVersion(): string | null {
  return load().lastSeenVersion ?? null
}

export function setLastSeenVersion(version: string): void {
  const s = load()
  s.lastSeenVersion = version
  persist()
}

/** Server account ids hidden from the Recently Watched user dropdown. */
export function getHiddenHistoryUsers(): number[] {
  return load().hiddenHistoryUsers ?? []
}

export function setHistoryUserHidden(accountId: number, hidden: boolean): void {
  const s = load()
  const set = new Set(s.hiddenHistoryUsers ?? [])
  if (hidden) set.add(accountId)
  else set.delete(accountId)
  s.hiddenHistoryUsers = [...set]
  persist()
}

export function getPlaybackPrefs(): PlaybackPrefs {
  return { ...DEFAULT_PLAYBACK_PREFS, ...(load().playbackPrefs ?? {}) }
}

export function setPlaybackPrefs(prefs: PlaybackPrefs): void {
  load().playbackPrefs = prefs
  persist()
}

export function getLastVolume(): number {
  return load().lastVolume ?? 100
}

export function setLastVolume(volume: number): void {
  load().lastVolume = volume
  persist()
}

export function getLastSpeed(): number {
  return load().lastSpeed ?? 1
}

export function setLastSpeed(speed: number): void {
  load().lastSpeed = speed
  persist()
}

export function getLastSubScale(): number {
  return load().lastSubScale ?? 1
}

export function setLastSubScale(scale: number): void {
  load().lastSubScale = scale
  persist()
}

export function getLastAccount(): PlexAccount | null {
  return load().lastAccount ?? null
}

export function setLastAccount(account: PlexAccount | null): void {
  if (account === null) delete load().lastAccount
  else load().lastAccount = account
  persist()
}

export function setLibraryHidden(sectionId: string, hidden: boolean): void {
  const state = load()
  const set = new Set(state.hiddenLibraries)
  if (hidden) set.add(sectionId)
  else set.delete(sectionId)
  state.hiddenLibraries = [...set]
  persist()
}

// --- Synced playlists ------------------------------------------------------

export function getSyncedPlaylists(): SyncedPlaylistGroup[] {
  return load().syncedPlaylists ?? []
}

/** Insert or replace a sync group (matched by serverId + adminRatingKey). */
export function saveSyncGroup(group: SyncedPlaylistGroup): void {
  const state = load()
  const groups = state.syncedPlaylists ?? []
  const idx = groups.findIndex(
    (g) => g.serverId === group.serverId && g.adminRatingKey === group.adminRatingKey
  )
  if (idx >= 0) groups[idx] = group
  else groups.push(group)
  state.syncedPlaylists = groups
  persist()
}

export function removeSyncGroup(serverId: string, adminRatingKey: string): void {
  const state = load()
  state.syncedPlaylists = (state.syncedPlaylists ?? []).filter(
    (g) => !(g.serverId === serverId && g.adminRatingKey === adminRatingKey)
  )
  persist()
}

// --- Cached Home-user tokens (for background sync without re-prompting PIN) -

export function getHomeUserToken(uuid: string): string | null {
  const enc = load().homeUserTokens?.[uuid]
  return enc ? decryptOrNull(enc) : null
}

export function setHomeUserToken(uuid: string, token: string): void {
  const enc = encryptOrNull(token)
  if (!enc) {
    // No secure storage — don't persist a Home-user token in plaintext; sync
    // will fall back to its re-auth path.
    console.warn('[store] OS secure storage unavailable; not caching Home-user token.')
    return
  }
  const state = load()
  if (!state.homeUserTokens) state.homeUserTokens = {}
  state.homeUserTokens[uuid] = enc
  persist()
}

// --- Watchlist -------------------------------------------------------------

export function getWatchlist(serverId: string): WatchlistEntry[] {
  return load().watchlist?.[serverId] ?? []
}

export function addToWatchlist(serverId: string, entry: WatchlistEntry): WatchlistEntry[] {
  const state = load()
  if (!state.watchlist) state.watchlist = {}
  const existing = (state.watchlist[serverId] ?? []).filter((e) => e.ratingKey !== entry.ratingKey)
  state.watchlist[serverId] = [entry, ...existing]
  persist()
  return state.watchlist[serverId]
}

export function removeFromWatchlist(serverId: string, ratingKey: string): WatchlistEntry[] {
  const state = load()
  if (!state.watchlist) state.watchlist = {}
  state.watchlist[serverId] = (state.watchlist[serverId] ?? []).filter(
    (e) => e.ratingKey !== ratingKey
  )
  persist()
  return state.watchlist[serverId]
}

// --- Per-show audio/subtitle defaults --------------------------------------

export function getShowPref(key: string): ShowMediaPref | undefined {
  return load().showPrefs?.[key]
}

/** Merge a partial preference into a show's remembered track choices. */
export function setShowPref(key: string, patch: ShowMediaPref): void {
  const state = load()
  if (!state.showPrefs) state.showPrefs = {}
  state.showPrefs[key] = { ...state.showPrefs[key], ...patch }
  persist()
}
