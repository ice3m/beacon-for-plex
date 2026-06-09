import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { MediaInfo, MediaTrack, PlaybackPrefs, PlaybackStatus, SubtitleOption } from '@shared/types'
import { IPC } from '@shared/ipc'
import { DEFAULT_QUALITY, qualityById } from '@shared/quality'
import {
  buildTranscodeUrl,
  downloadSubtitle,
  getAdjacentEpisodes,
  getExternalSubs,
  getPlaybackInfo,
  markPlayed,
  pingTranscode,
  reportTimeline,
  searchSubtitles as searchSubtitlesApi,
  stopTranscode,
  type PlaybackInfo,
  type SubtitleSearchResult
} from '../plex/client'
import { getServerById } from '../plex/servers'
import {
  getLastSpeed,
  getLastSubScale,
  getLastVolume,
  getPlaybackPrefs,
  getShowPref,
  setLastSpeed,
  setLastSubScale,
  setLastVolume,
  setShowPref
} from '../store'
import { MpvClient, resolveMpvPath } from './mpv'

let mainWindow: BrowserWindow | null = null
export function setPlayerWindow(win: BrowserWindow): void {
  mainWindow = win
}

// Optional listener (e.g. the Companion server) notified on every status push.
let statusListener: ((s: PlaybackStatus) => void) | null = null
export function setStatusListener(cb: ((s: PlaybackStatus) => void) | null): void {
  statusListener = cb
}

/**
 * A single TRANSPARENT window hosts BOTH the embedded mpv video (via --wid) and
 * the React controls overlay: mpv's child surface composites BENEATH the
 * transparent Chromium layer, so controls float over the video. This is the
 * only layout where a transparent overlay actually shows hardware video (a
 * separate transparent window can't composite another window's D3D content).
 */
let playerWin: BrowserWindow | null = null
let syncBounds: (() => void) | null = null

// Docked mini-video geometry — MUST match the reserved slot in MiniPlayer.tsx
// (bar height 72, left pad 16, a 100×56 16:9 box vertically centered).
const BAR_H = 72
const DOCK_W = 100
const DOCK_H = 56
const DOCK_PAD_X = 16
const DOCK_PAD_Y = 8

/** Screen rect of the docked mini-video, anchored to the bottom-left bar slot. */
function dockRect(): Electron.Rectangle {
  const b = mainWindow!.getContentBounds()
  return {
    x: b.x + DOCK_PAD_X,
    y: b.y + b.height - BAR_H + DOCK_PAD_Y,
    width: DOCK_W,
    height: DOCK_H
  }
}

// --- Small helpers so the window ops below stay window-count-agnostic. ---
function windowsAlive(): boolean {
  return !!playerWin && !playerWin.isDestroyed()
}
function eachPlayerWin(fn: (w: BrowserWindow) => void): void {
  if (playerWin && !playerWin.isDestroyed()) fn(playerWin)
}
function setPlayerBounds(rect: Electron.Rectangle): void {
  if (playerWin && !playerWin.isDestroyed()) playerWin.setBounds(rect)
}
function showPlayerWindows(): void {
  if (playerWin && !playerWin.isDestroyed() && !playerWin.isVisible()) playerWin.show()
}

/**
 * Get (creating once, then reusing) the persistent transparent player window
 * and return its native handle. The window is NEVER destroyed between plays —
 * mpv stays embedded in it and just loads new files — so its render surface
 * and mpv's video output initialize a single time.
 */
function ensurePlayerWindow(): string {
  if (!mainWindow) throw new Error('No main window')
  const content = mainWindow.getContentBounds()

  if (!playerWin || playerWin.isDestroyed()) {
    console.log('[player] creating player window', content)
    playerWin = new BrowserWindow({
      parent: mainWindow,
      x: content.x,
      y: content.y,
      width: content.width,
      height: content.height,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        // The overlay is never the OS-focused window (mpv's surface sits under
        // it), so Electron's default background throttling would starve its
        // renderer — freezing the seek bar / status updates that arrive via IPC.
        backgroundThrottling: false
      }
    })
    playerWin.setMenuBarVisibility(false)
    if (process.env.ELECTRON_RENDERER_URL) {
      void playerWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}?overlay=1`)
    } else {
      void playerWin.loadFile(join(__dirname, '../renderer/index.html'), { search: 'overlay=1' })
    }

    syncBounds = (): void => {
      if (!playerWin || !mainWindow || playerWin.isDestroyed()) return
      playerWin.setBounds(session?.minimized ? dockRect() : mainWindow.getContentBounds())
    }
    mainWindow.on('resize', syncBounds)
    mainWindow.on('move', syncBounds)
  } else {
    playerWin.setAlwaysOnTop(false)
    playerWin.setMovable(false)
    playerWin.setBounds(content)
    showPlayerWindows()
  }

  // Full 64-bit native handle (HWNDs are 64-bit on Windows x64).
  const handle = playerWin.getNativeWindowHandle()
  return handle.length >= 8
    ? handle.readBigUInt64LE(0).toString()
    : String(handle.readUInt32LE(0))
}

/** Hide the player window between plays (kept alive so mpv stays embedded). */
function hidePlayerWindow(): void {
  if (playerWin && !playerWin.isDestroyed()) playerWin.hide()
}

interface Session {
  mpv: MpvClient
  serverId: string
  ratingKey: string
  info: PlaybackInfo
  timeMs: number
  durationMs: number
  paused: boolean
  volume: number
  skipped: Set<number>
  skip: PlaybackStatus['skip']
  lastReportAt: number
  scrobbled: boolean
  prefs: PlaybackPrefs
  prevRatingKey: string | null
  nextRatingKey: string | null
  /** When set on exit, start this item next (auto-play or manual Next/Prev). */
  advanceTo: string | null
  advanceQuality: string | null
  advanceStartMs: number | null
  /** True when the video window is hidden (audio continues; mini-bar shows). */
  minimized: boolean
  /** Current quality preset id, and active transcode session (if any). */
  quality: string
  transcodeSession: string | null
  speed: number
  subScale: number
  fullscreen: boolean
  nextLabel: string | null
  /** User dismissed the Up Next prompt — suppress auto-advance for this item. */
  upNextCancelled: boolean
  /** Set when a newer start() replaced this session; its mpv events become no-ops. */
  superseded: boolean
  /** Floating picture-in-picture mode (small always-on-top window). */
  pip: boolean
  /** True once mpv has produced its first frame (time-pos seen). */
  loaded: boolean
}

let session: Session | null = null

/**
 * Heartbeat that keeps the active Plex transcode session alive. Once mpv buffers
 * ahead it stops fetching segments; without this ping the PMS reaps the session
 * after ~20-60s of inactivity and playback silently dies (the dreaded "stops a
 * minute in"). Pings every 10s regardless of pause/buffer state.
 */
let transcodePing: ReturnType<typeof setInterval> | null = null
function startTranscodePing(serverId: string, sessionId: string): void {
  stopTranscodePing()
  transcodePing = setInterval(() => {
    void pingTranscode(serverId, sessionId)
  }, 10000)
  // Ping immediately so the session is touched well before the idle window.
  void pingTranscode(serverId, sessionId)
}
function stopTranscodePing(): void {
  if (transcodePing) {
    clearInterval(transcodePing)
    transcodePing = null
  }
}

// One long-lived mpv instance, embedded in the persistent window. Created lazily
// on first play and kept alive (idle between plays) so its video output only
// initializes once. The 'exit' handler (attached in ensureMpv) clears it.
let mpv: MpvClient | null = null

/**
 * Ensure the persistent mpv process + window exist, with event listeners
 * attached exactly once. Returns the live client.
 */
async function ensureMpv(): Promise<MpvClient> {
  if (mpv && mpv.isAlive()) {
    showPlayerWindows()
    return mpv
  }
  const mpvPath = resolveMpvPath()
  if (!mpvPath) throw new Error('mpv player not found in resources.')
  const wid = ensurePlayerWindow()
  const client = new MpvClient()
  mpv = client

  client.on('property', (name: string, data: unknown) => {
    if (!session) return
    if (name === 'time-pos') onTime(data as number)
    else if (name === 'duration' && typeof data === 'number') session.durationMs = data * 1000
    else if (name === 'volume' && typeof data === 'number') {
      session.volume = Math.round(data)
      setLastVolume(session.volume)
      push()
    } else if (name === 'pause') {
      session.paused = !!data
      report(session.paused ? 'paused' : 'playing', true)
      push()
    }
  })
  // First frame of the CURRENT load is ready — drop the black load screen.
  client.on('playback-restart', () => {
    if (session && !session.loaded) {
      session.loaded = true
      push()
    }
  })
  // Natural end-of-file → auto-play the next episode (loads in place, no respawn).
  client.on('end-file', (reason: string) => {
    const s = session
    if (!s) return
    if (reason === 'eof' && s.prefs.autoPlayNext && s.nextRatingKey && !s.upNextCancelled) {
      start(s.serverId, s.nextRatingKey, { quality: s.quality, preserveView: true }).catch((e) =>
        console.error('[player] auto-advance failed:', (e as Error).message)
      )
    } else if (reason === 'error') {
      // A dead stream (e.g. the PMS reaped the transcode session) ends the file
      // with 'error'. Don't die silently — surface it so the user isn't staring
      // at a frozen frame wondering what happened.
      console.error('[player] stream ended unexpectedly (mpv end-file: error)')
      stopTranscodePing()
      push({ error: 'Playback stopped: the stream ended unexpectedly. Try again or pick a different quality.' })
    }
  })
  client.on('error', (err: Error) => {
    console.error('[player] mpv error:', err)
    push({ error: err.message })
  })
  client.on('exit', () => {
    console.log('[player] mpv process exited')
    if (session) report('stopped', true)
    stopTranscodePing()
    mpv = null
    session = null
    hidePlayerWindow()
    push({ active: false })
  })

  await client.start(mpvPath, wid, [])
  // Restore persistent properties once (they carry across loaded files).
  client.setProperty('volume', getLastVolume()).catch(() => {})
  client.setProperty('speed', getLastSpeed()).catch(() => {})
  client.setProperty('sub-scale', getLastSubScale()).catch(() => {})
  client.observeProperty('time-pos')
  client.observeProperty('duration')
  client.observeProperty('pause')
  client.observeProperty('volume')
  return client
}


function push(extra: Partial<PlaybackStatus> = {}): void {
  const status: PlaybackStatus = session
    ? {
        active: true,
        ratingKey: session.ratingKey,
        title: session.info.title,
        timeMs: session.timeMs,
        durationMs: session.durationMs || session.info.durationMs,
        paused: session.paused,
        volume: session.volume,
        skip: session.skip,
        hasNext: !!session.nextRatingKey,
        hasPrev: !!session.prevRatingKey,
        minimized: session.minimized,
        quality: session.quality,
        speed: session.speed,
        subScale: session.subScale,
        fullscreen: session.fullscreen,
        pip: session.pip,
        loaded: session.loaded,
        upNext: upNextPrompt(session),
        ...extra
      }
    : { active: false, ...extra }
  // Broadcast to the main window (MiniPlayer/PlayerView) and the player window.
  for (const w of [mainWindow, playerWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(IPC.playback.status, status)
  }
  statusListener?.(status)
}

/** Throttled Plex timeline report (≤ every 5s) plus near-end scrobble. */
function report(state: 'playing' | 'paused' | 'stopped', force = false): void {
  if (!session) return
  const now = Date.now()
  if (!force && state === 'playing' && now - session.lastReportAt < 5000) return
  session.lastReportAt = now
  void reportTimeline(session.serverId, {
    ratingKey: session.ratingKey,
    key: session.info.key,
    state,
    timeMs: session.timeMs,
    durationMs: session.durationMs || session.info.durationMs
  })
  // Mark watched once past 90%.
  const dur = session.durationMs || session.info.durationMs
  if (!session.scrobbled && dur > 0 && session.timeMs / dur >= 0.9) {
    session.scrobbled = true
    void markPlayed(session.serverId, session.ratingKey)
  }
}

/** Show the Up Next prompt in the final 30s when a next episode is queued. */
function upNextPrompt(s: Session): PlaybackStatus['upNext'] {
  const dur = s.durationMs || s.info.durationMs
  if (
    s.nextRatingKey &&
    s.prefs.autoPlayNext &&
    !s.upNextCancelled &&
    dur > 0 &&
    s.timeMs >= dur - 30000
  ) {
    return { label: s.nextLabel ?? 'Next episode' }
  }
  return null
}

function onTime(seconds: number): void {
  if (!session || typeof seconds !== 'number') return
  session.timeMs = seconds * 1000
  checkSkip()
  report('playing')
  push()
}

/**
 * Auto-skip intro/credits per preferences; otherwise surface a skip prompt the
 * user can act on with the Skip button.
 */
function checkSkip(): void {
  if (!session) return
  const s = session
  let prompt: PlaybackStatus['skip'] = null
  s.info.markers.forEach((m, i) => {
    const inRange = s.timeMs >= m.startTimeOffset && s.timeMs < m.endTimeOffset - 1000
    if (!inRange) return
    const isIntro = m.type === 'intro'
    const auto = isIntro ? s.prefs.autoSkipIntro : s.prefs.autoSkipCredits
    if (auto) {
      if (!s.skipped.has(i)) {
        s.skipped.add(i)
        s.mpv.command('seek', m.endTimeOffset / 1000, 'absolute').catch(() => {})
        s.mpv.command('show-text', isIntro ? 'Skipped intro' : 'Skipped credits', 1500).catch(() => {})
      }
    } else {
      prompt = { kind: isIntro ? 'intro' : 'credits', untilMs: m.endTimeOffset }
    }
  })
  s.skip = prompt
}

/** The key under which we remember audio/sub choices: the show, else the item. */
function showKeyOf(info: PlaybackInfo, ratingKey: string): string {
  return info.type === 'episode' && info.grandparentRatingKey ? info.grandparentRatingKey : ratingKey
}

export async function start(
  serverId: string,
  ratingKey: string,
  opts: { quality?: string; startMs?: number; preserveView?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!mainWindow) return { ok: false, error: 'No window' }
  console.log('[player] start', ratingKey)

  let info: PlaybackInfo
  try {
    info = await getPlaybackInfo(serverId, ratingKey)
  } catch (err) {
    console.error('[player] resolve failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to resolve media' }
  }
  console.log('[player] resolved:', info.title, 'resume(ms):', info.viewOffsetMs)

  const prefs = getPlaybackPrefs()
  let prevRatingKey: string | null = null
  let nextRatingKey: string | null = null
  let nextLabel: string | null = null
  if (info.type === 'episode' && info.grandparentRatingKey) {
    const adj = await getAdjacentEpisodes(serverId, info.grandparentRatingKey, ratingKey)
    prevRatingKey = adj.prev
    nextRatingKey = adj.next
    nextLabel = adj.nextLabel
  }

  // Resolve the stream URL for the chosen quality (Original = direct play).
  const qualityId = opts.quality ?? prefs.defaultQuality ?? DEFAULT_QUALITY
  const q = qualityById(qualityId)
  let streamUrl = info.url
  let transcodeSession: string | null = null
  if (q.maxBitrate) {
    transcodeSession = randomUUID()
    try {
      streamUrl = await buildTranscodeUrl(serverId, ratingKey, q, transcodeSession, prefs.surround)
    } catch (err) {
      console.error('[player] transcode url failed, falling back to direct:', err)
      streamUrl = info.url
      transcodeSession = null
    }
  }
  console.log('[player] quality', qualityId, transcodeSession ? '(transcode)' : '(direct)')

  // Adaptive read-ahead buffer: fast local direct-play needs only a modest
  // cushion; remote/transcoded streams get a large forward buffer.
  const isLocalDirect =
    transcodeSession === null &&
    (await getServerById(serverId).catch(() => null))?.bestConnection?.local === true

  // Ensure the one long-lived mpv + window exist (created on first play).
  let client: MpvClient
  try {
    client = await ensureMpv()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to start player' }
  }

  // Release the previous item's transcode session (if it had one).
  if (session?.transcodeSession && session.transcodeSession !== transcodeSession) {
    stopTranscode(session.serverId, session.transcodeSession).catch((e) =>
      console.warn('[player] stopTranscode failed:', (e as Error).message)
    )
  }

  const startMs = opts.startMs ?? (info.viewOffsetMs > 10000 ? info.viewOffsetMs : 0)
  const resumeSec = Math.floor(startMs / 1000)

  // Per-show remembered audio/subtitle choices override the global defaults.
  const showPref = getShowPref(showKeyOf(info, ratingKey))
  const audioLang = showPref?.audioLang ?? prefs.audioLang
  const subtitleLang = showPref?.subtitleLang ?? prefs.subtitleLang
  const subtitlesOn = showPref?.subtitlesOn ?? prefs.subtitlesOn

  const s: Session = {
    mpv: client,
    serverId,
    ratingKey,
    info,
    timeMs: startMs,
    durationMs: info.durationMs,
    paused: false,
    volume: getLastVolume(),
    skipped: new Set(),
    skip: null,
    lastReportAt: 0,
    scrobbled: false,
    prefs,
    prevRatingKey,
    nextRatingKey,
    advanceTo: null,
    advanceQuality: null,
    advanceStartMs: null,
    // A fresh, user-initiated play always opens in the full view. Internal
    // transitions (next/prev/quality/auto-advance) keep the current dock state.
    minimized: opts.preserveView ? (session?.minimized ?? false) : false,
    quality: qualityId,
    transcodeSession,
    speed: getLastSpeed(),
    subScale: getLastSubScale(),
    fullscreen: false,
    nextLabel,
    upNextCancelled: false,
    superseded: false,
    pip: false,
    loaded: false
  }
  session = s

  // Reset the overlay window geometry for the view we're starting in. The mpv
  // window is reused between plays, so without this a previous minimized/PiP
  // session would leave the video docked in the corner for the new item.
  if (playerWin && !playerWin.isDestroyed() && mainWindow) {
    playerWin.setAlwaysOnTop(false)
    playerWin.setMovable(false)
    playerWin.setBounds(s.minimized ? dockRect() : mainWindow.getContentBounds())
  }
  showPlayerWindows()

  // Apply per-file settings as properties BEFORE loadfile (they take effect for
  // the next loaded file). Set every play so they don't bleed across titles.
  const setp = (k: string, v: string | number): void => {
    client.setProperty(k, v).catch(() => {})
  }
  setp('alang', audioLang)
  setp('slang', subtitleLang)
  setp('sub-visibility', subtitlesOn ? 'yes' : 'no')
  setp('audio-channels', prefs.surround ? 'auto-safe' : 'stereo')
  setp('cache', 'yes')
  setp('demuxer-max-bytes', isLocalDirect ? '128MiB' : '512MiB')
  setp('demuxer-max-back-bytes', isLocalDirect ? '64MiB' : '128MiB')
  setp('demuxer-readahead-secs', isLocalDirect ? 20 : 60)
  setp('cache-secs', isLocalDirect ? 60 : 120)
  setp('start', resumeSec ? String(resumeSec) : 'none')

  try {
    await client.load(streamUrl)
  } catch (err) {
    console.error('[player] loadfile failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load media' }
  }
  // Keep the transcode session alive (mpv goes silent once buffered). Always
  // (re)start the heartbeat for the new session id; no-op for direct play.
  if (transcodeSession) startTranscodePing(serverId, transcodeSession)
  else stopTranscodePing()

  // Title carries special chars, so set it after load (not in the options string).
  client.setProperty('force-media-title', info.title).catch(() => {})
  // mpv's `pause` property persists across loadfile, so a previously-paused
  // session would make the new item start paused — force it to play.
  client.setProperty('pause', false).catch(() => {})
  session.paused = false
  report('playing', true)
  push()

  // Safety net: never leave the black load screen up if 'playback-restart' is missed.
  setTimeout(() => {
    if (session === s && !s.loaded) {
      s.loaded = true
      push()
    }
  }, 10000)
  return { ok: true }
}

/** Stop playback: report to Plex, stop the current file (mpv stays idle), hide. */
export function stop(): void {
  stopTranscodePing()
  if (session) {
    report('stopped', true) // tell Plex Now Playing ended
    if (session.transcodeSession)
      stopTranscode(session.serverId, session.transcodeSession).catch((e) =>
        console.warn('[player] stopTranscode failed:', (e as Error).message)
      )
    // Don't leave the app stuck in fullscreen once the video is gone.
    if (session.fullscreen && mainWindow) mainWindow.setFullScreen(false)
  }
  session = null
  mpv?.stopFile()
  hidePlayerWindow()
  push({ active: false })
}

/** Fully quit the persistent mpv process (called on app exit). */
export function shutdown(): void {
  stopTranscodePing()
  if (session) {
    report('stopped', true)
    if (session.transcodeSession)
      stopTranscode(session.serverId, session.transcodeSession).catch((e) =>
        console.warn('[player] stopTranscode failed:', (e as Error).message)
      )
  }
  session = null
  mpv?.quit()
  mpv = null
}

export function playPause(): void {
  session?.mpv.command('cycle', 'pause').catch(() => {})
}

export function setPaused(paused: boolean): void {
  session?.mpv.setProperty('pause', paused).catch(() => {})
}

/** Whether something is currently playing (for the Companion server). */
export function isActive(): boolean {
  return session !== null
}

/** Clamp a target time (ms) to [0, duration] so bad offsets can't hang mpv. */
function clampMs(ms: number): number {
  const dur = session?.durationMs || session?.info.durationMs || 0
  const max = dur > 0 ? dur : Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.min(max, Math.floor(ms)))
}

export function seekTo(ms: number): void {
  if (!session) return
  session.mpv.command('seek', clampMs(ms) / 1000, 'absolute').catch(() => {})
}

export function seekBy(seconds: number): void {
  if (!session) return
  // Resolve to an absolute (clamped) position rather than a raw relative delta.
  const target = clampMs((session.timeMs || 0) + seconds * 1000)
  session.mpv.command('seek', target / 1000, 'absolute').catch(() => {})
}

export function setVolume(volume: number): void {
  session?.mpv.setProperty('volume', Math.max(0, Math.min(130, volume))).catch(() => {})
}

export function setSpeed(speed: number): void {
  if (!session) return
  session.speed = Math.max(0.25, Math.min(4, speed))
  session.mpv.setProperty('speed', session.speed).catch(() => {})
  setLastSpeed(session.speed)
  push()
}

export function setSubScale(scale: number): void {
  if (!session) return
  session.subScale = Math.max(0.5, Math.min(3, scale))
  session.mpv.setProperty('sub-scale', session.subScale).catch(() => {})
  setLastSubScale(session.subScale)
  push()
}

export function toggleFullscreen(): void {
  if (!session || !mainWindow) return
  // Toggle off our own tracked state — the transparent, non-resizable overlay
  // window reports `isFullScreen()` unreliably on Windows, so it could never
  // exit. Fullscreen the (resizable) main window instead; `syncBounds` resizes
  // the overlay to follow it.
  const fs = !session.fullscreen
  session.fullscreen = fs
  mainWindow.setFullScreen(fs)
  if (!session.minimized) {
    setPlayerBounds(mainWindow.getContentBounds())
  }
  if (syncBounds) syncBounds()
  push()
}

/** Bring the app to the front, fullscreen, with the video covering it — used
 * when a phone casts to us so playback starts front-and-center fullscreen. */
export function presentForCast(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  mainWindow.setFullScreen(true)
  if (session) {
    session.fullscreen = true
    session.minimized = false
    session.pip = false
  }
  eachPlayerWin((w) => w.setAlwaysOnTop(false))
  showPlayerWindows()
  setPlayerBounds(mainWindow.getContentBounds())
  if (syncBounds) syncBounds()
  push()
}

export function cancelUpNext(): void {
  if (!session) return
  session.upNextCancelled = true
  push()
}

export function skip(): void {
  if (session?.skip) seekTo(session.skip.untilMs)
}

/** Manually advance to the next episode (keeps the current quality). */
export function next(): void {
  if (session?.nextRatingKey)
    void start(session.serverId, session.nextRatingKey, { quality: session.quality, preserveView: true })
}

/** Go to the previous episode (keeps the current quality). */
export function prev(): void {
  if (session?.prevRatingKey)
    void start(session.serverId, session.prevRatingKey, { quality: session.quality, preserveView: true })
}

/** Switch streaming quality, reloading at the current position. */
export function setQuality(qualityId: string): void {
  if (!session || qualityId === session.quality) return
  void start(session.serverId, session.ratingKey, {
    quality: qualityId,
    startMs: session.timeMs,
    preserveView: true
  })
}

/** Dock the live video into the mini-bar's bottom-left slot (keeps playing). */
export function minimize(): void {
  if (!session || !windowsAlive() || !mainWindow) return
  session.pip = false
  session.minimized = true
  eachPlayerWin((w) => {
    w.setAlwaysOnTop(false)
    w.setMovable(false)
  })
  showPlayerWindows()
  setPlayerBounds(dockRect())
  push()
}

/** Restore the video to cover the main window. */
export function expand(): void {
  if (!session || !windowsAlive() || !mainWindow) return
  session.minimized = false
  session.pip = false
  eachPlayerWin((w) => w.setAlwaysOnTop(false))
  setPlayerBounds(mainWindow.getContentBounds())
  showPlayerWindows()
  push()
}

const PIP_W = 480
const PIP_H = 270
const PIP_MARGIN = 24

/**
 * Toggle floating picture-in-picture: shrink playback to an always-on-top
 * corner box (detached from the main window) so you can keep watching while you
 * browse — or restore it to cover the main window.
 */
export function togglePip(): void {
  if (!session || !windowsAlive() || !mainWindow) return
  const s = session
  s.pip = !s.pip
  if (s.pip) {
    // Detach from the main window's bounds and float in the corner.
    if (syncBounds) {
      mainWindow.removeListener('resize', syncBounds)
      mainWindow.removeListener('move', syncBounds)
    }
    s.minimized = false
    showPlayerWindows()
    const b = mainWindow.getBounds()
    setPlayerBounds({
      x: b.x + b.width - PIP_W - PIP_MARGIN,
      y: b.y + b.height - PIP_H - PIP_MARGIN,
      width: PIP_W,
      height: PIP_H
    })
    eachPlayerWin((w) => w.setAlwaysOnTop(true, 'floating'))
  } else {
    // Re-attach to the main window and resume covering it.
    eachPlayerWin((w) => w.setAlwaysOnTop(false))
    setPlayerBounds(mainWindow.getContentBounds())
    if (syncBounds) {
      mainWindow.on('resize', syncBounds)
      mainWindow.on('move', syncBounds)
    }
  }
  push()
}

async function rawTracks(): Promise<MediaTrack[]> {
  if (!session) return []
  try {
    const list = (await session.mpv.command('get_property', 'track-list')) as Record<
      string,
      unknown
    >[]
    return (list ?? []).map((t) => ({
      id: Number(t.id),
      type: String(t.type) as MediaTrack['type'],
      selected: t.selected === true,
      lang: t.lang ? String(t.lang) : undefined,
      title: t.title ? String(t.title) : undefined,
      codec: t.codec ? String(t.codec) : undefined,
      channels:
        typeof t['demux-channel-count'] === 'number'
          ? (t['demux-channel-count'] as number)
          : undefined
    }))
  } catch {
    return []
  }
}

function trackLabel(t: MediaTrack): string {
  const parts = [
    t.lang?.toUpperCase(),
    t.title,
    t.channels ? `${t.channels}.0`.replace('6.0', '5.1').replace('8.0', '7.1') : undefined,
    t.codec ? t.codec.toUpperCase() : undefined
  ].filter(Boolean)
  return parts.join(' · ') || `Track ${t.id}`
}

/** Live technical info about the current stream, read from mpv. */
export async function getMediaInfo(): Promise<MediaInfo | null> {
  if (!session) return null
  const s = session
  const get = async (p: string): Promise<unknown> => {
    try {
      return await s.mpv.command('get_property', p)
    } catch {
      return undefined
    }
  }
  const n = (v: unknown): number | undefined =>
    typeof v === 'number' && isFinite(v) ? v : undefined
  const str = (v: unknown): string | undefined => (v ? String(v) : undefined)

  const [w, h, vcodec, vbr, fps, acodec, ach, abr, container, hwdec] = await Promise.all([
    get('width'),
    get('height'),
    get('video-codec'),
    get('video-bitrate'),
    get('container-fps'),
    get('audio-codec-name'),
    get('audio-params/channel-count'),
    get('audio-bitrate'),
    get('file-format'),
    get('hwdec-current')
  ])
  const ch = n(ach)
  const channels =
    ch === undefined
      ? undefined
      : ch === 6
        ? '5.1'
        : ch === 8
          ? '7.1'
          : ch === 1
            ? 'Mono'
            : ch === 2
              ? 'Stereo'
              : `${ch}ch`
  const kbps = (v: unknown): number | undefined => {
    const x = n(v)
    return x === undefined ? undefined : Math.round(x / 1000)
  }
  const hw = str(hwdec)
  return {
    playbackMethod: s.transcodeSession ? 'Transcode' : 'Direct Play',
    quality: qualityById(s.quality)?.label,
    resolution: n(w) && n(h) ? `${n(w)}×${n(h)}` : undefined,
    videoCodec: str(vcodec),
    videoBitrateKbps: kbps(vbr),
    fps: n(fps) ? Math.round((n(fps) as number) * 100) / 100 : undefined,
    audioCodec: str(acodec)?.toUpperCase(),
    audioChannels: channels,
    audioBitrateKbps: kbps(abr),
    container: str(container)?.toUpperCase(),
    hwDecode: hw && hw !== 'no' ? hw : 'Software'
  }
}

export async function audioTracks(): Promise<MediaTrack[]> {
  return (await rawTracks()).filter((t) => t.type === 'audio')
}

export async function subtitleOptions(): Promise<SubtitleOption[]> {
  const embedded = (await rawTracks()).filter((t) => t.type === 'sub')
  const anySelected = embedded.some((t) => t.selected)
  const opts: SubtitleOption[] = [
    { key: 'off', label: 'None', kind: 'off', selected: !anySelected }
  ]
  for (const t of embedded) {
    opts.push({ key: `emb-${t.id}`, label: trackLabel(t), kind: 'embedded', id: t.id, selected: t.selected })
  }
  ;(session?.info.externalSubs ?? []).forEach((ext, i) => {
    opts.push({ key: `ext-${i}`, label: `${ext.title} (external)`, kind: 'external', url: ext.url, selected: false })
  })
  return opts
}

export async function selectAudio(id: number): Promise<void> {
  if (!session) return
  const s = session
  await s.mpv.setProperty('aid', id).catch(() => {})
  // Remember the chosen audio language for this show/movie.
  const track = (await rawTracks()).find((t) => t.type === 'audio' && t.id === id)
  if (track?.lang) setShowPref(showKeyOf(s.info, s.ratingKey), { audioLang: track.lang })
}

/** Search OpenSubtitles for the current item (uses the preferred sub language). */
export async function searchSubtitles(): Promise<SubtitleSearchResult[]> {
  if (!session) return []
  try {
    return await searchSubtitlesApi(session.serverId, session.ratingKey, session.prefs.subtitleLang)
  } catch (err) {
    console.error('[player] subtitle search failed:', (err as Error).message)
    return []
  }
}

/** Download a searched subtitle, then load + select it in mpv. */
export async function downloadSubtitleAndApply(key: string): Promise<void> {
  if (!session) return
  const s = session
  try {
    await downloadSubtitle(s.serverId, s.ratingKey, key)
    const subs = await getExternalSubs(s.serverId, s.ratingKey)
    s.info.externalSubs = subs
    const sel = subs.find((x) => x.selected) ?? subs[subs.length - 1]
    if (sel) {
      await s.mpv.command('sub-add', sel.url, 'select').catch(() => {})
      s.mpv.setProperty('sub-visibility', 'yes').catch(() => {})
    }
    push()
  } catch (err) {
    console.error('[player] subtitle download failed:', (err as Error).message)
  }
}

export async function selectSubtitle(opt: SubtitleOption): Promise<void> {
  if (!session) return
  const s = session
  const key = showKeyOf(s.info, s.ratingKey)
  if (opt.kind === 'off') {
    s.mpv.setProperty('sid', 'no').catch(() => {})
    setShowPref(key, { subtitlesOn: false })
  } else if (opt.kind === 'embedded' && opt.id != null) {
    s.mpv.setProperty('sid', opt.id).catch(() => {})
    s.mpv.setProperty('sub-visibility', 'yes').catch(() => {})
    const track = (await rawTracks()).find((t) => t.type === 'sub' && t.id === opt.id)
    setShowPref(key, { subtitlesOn: true, ...(track?.lang ? { subtitleLang: track.lang } : {}) })
  } else if (opt.kind === 'external' && opt.url) {
    await s.mpv.command('sub-add', opt.url, 'select').catch(() => {})
    s.mpv.setProperty('sub-visibility', 'yes').catch(() => {})
    setShowPref(key, { subtitlesOn: true })
  }
}
