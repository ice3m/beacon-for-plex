import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MediaInfo, MediaTrack, PlaybackStatus, SubtitleOption } from '@shared/types'
import { QUALITIES } from '@shared/quality'
import { Icon } from './icons'

function fmt(ms?: number): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/**
 * Transparent player controls rendered in an overlay window above the embedded
 * mpv video: transport, seek bar, skip-intro/credits, and an audio/subtitle
 * settings panel (Plex-style).
 */
export function PlayerOverlay(): JSX.Element {
  const [st, setSt] = useState<PlaybackStatus>({ active: false })
  const [visible, setVisible] = useState(true)
  const [scrub, setScrub] = useState<number | null>(null)
  const scrubRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const scrubSafety = useRef<ReturnType<typeof setTimeout>>()
  const [menu, setMenu] = useState<'none' | 'settings'>('none')
  const [audio, setAudio] = useState<MediaTrack[]>([])
  const [subs, setSubs] = useState<SubtitleOption[]>([])
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const pausedRef = useRef(false)

  // The overlay window must be see-through where there's no chrome.
  useEffect(() => {
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    const unsub = window.plex.playback.onStatus((s) => {
      setSt(s)
      pausedRef.current = !!s.paused
      // Release the held scrub position only once playback has actually caught
      // up to where the user dropped it. Clearing earlier would snap the slider
      // back to live time, and that value-change fires a spurious onChange →
      // a second seek that reverts the first. Hold until convergence.
      if (
        !draggingRef.current &&
        scrubRef.current != null &&
        Math.abs((s.timeMs ?? 0) - scrubRef.current) < 2500
      ) {
        scrubRef.current = null
        clearTimeout(scrubSafety.current)
        setScrub(null)
      }
    })
    return unsub
  }, [])

  // Commit the held scrub to a single real seek when the drag ends. We do NOT
  // clear `scrub` here — it stays pinned to the target so the slider value never
  // snaps back to live (which would fire a spurious onChange → reverting seek).
  // The onStatus convergence check above releases it once playback arrives; a
  // safety timer clears it if the seek never lands.
  const commitScrub = useCallback(() => {
    draggingRef.current = false
    const v = scrubRef.current
    if (v == null) return
    void window.plex.playback.seekTo(v)
    clearTimeout(scrubSafety.current)
    scrubSafety.current = setTimeout(() => {
      scrubRef.current = null
      setScrub(null)
    }, 5000)
  }, [])

  const bump = useCallback(() => {
    setVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!pausedRef.current) {
        setVisible(false)
        setMenu('none')
      }
    }, 3500)
  }, [])

  useEffect(() => {
    bump()
    window.addEventListener('mousemove', bump)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousemove', bump)
      window.removeEventListener('keydown', onKey)
      clearTimeout(hideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onKey(e: KeyboardEvent): void {
    bump()
    if (e.key === ' ') {
      e.preventDefault()
      void window.plex.playback.playPause()
    } else if (e.key === 'ArrowRight') void window.plex.playback.seekBy(10)
    else if (e.key === 'ArrowLeft') void window.plex.playback.seekBy(-10)
    else if (e.key === 'f' || e.key === 'F') void window.plex.playback.toggleFullscreen()
    else if (e.key === 'p' || e.key === 'P') void window.plex.playback.togglePip()
    else if (e.key === 'Escape') void window.plex.playback.minimize()
  }

  const openSettings = async (): Promise<void> => {
    if (menu === 'settings') {
      setMenu('none')
      return
    }
    setAudio(await window.plex.playback.audioTracks())
    setSubs(await window.plex.playback.subtitleOptions())
    setMenu('settings')
  }

  const time = scrub ?? st.timeMs ?? 0
  const dur = st.durationMs ?? 0

  // Docked in the mini-bar: just show video; clicking it re-expands. Controls
  // live in the bottom bar (main window), so no overlay chrome here.
  if (st.active && st.minimized) {
    return (
      <div
        className="fixed inset-0"
        style={{ background: 'transparent' }}
        title="Expand"
        onClick={() => window.plex.playback.expand()}
      />
    )
  }

  // Compact controls for the small floating picture-in-picture window.
  if (st.active && st.pip) {
    return (
      <div
        className="group fixed inset-0 overflow-hidden"
        style={{ background: 'transparent' }}
        onMouseMove={bump}
      >
        <div className="absolute inset-0 z-0" onClick={() => window.plex.playback.playPause()} />
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-opacity ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={() => window.plex.playback.playPause()}
            aria-label="Play/Pause"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <Icon name={st.paused ? 'play' : 'pause'} className="h-4 w-4" />
          </button>
          <span className="flex-1 truncate text-xs text-white/90">{st.title}</span>
          <button
            onClick={() => window.plex.playback.togglePip()}
            aria-label="Exit picture-in-picture"
            title="Back to full size"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <Icon name="fullscreen" className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.plex.playback.stop()}
            aria-label="Close player"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'transparent', cursor: visible ? 'default' : 'none' }}
    >
      {/* Opaque black load screen until mpv renders its first frame — so the
          transparent window never shows the page behind it while buffering. */}
      {!st.loaded && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          {st.error ? (
            <div className="px-6 text-center">
              <p className="mb-3 text-sm text-red-400">{st.error}</p>
              <button
                onClick={() => window.plex.playback.stop()}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-white/80">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="text-sm">Loading…</span>
            </div>
          )}
        </div>
      )}

      {/* Full-area click catcher: click toggles play/pause, double-click fullscreen. */}
      <div
        className="absolute inset-0 z-0"
        onClick={() => window.plex.playback.playPause()}
        onDoubleClick={() => window.plex.playback.toggleFullscreen()}
      />

      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          onClick={() => window.plex.playback.minimize()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          title="Minimize"
          aria-label="Minimize"
        >
          <Icon name="chevronDown" className="h-5 w-5" />
        </button>
        <span className="flex-1 truncate text-lg font-semibold text-white drop-shadow">
          {st.title}
        </span>
        <button
          onClick={() => window.plex.playback.stop()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          title="Close (Esc)"
          aria-label="Close player"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      {/* Up Next card */}
      {st.upNext && (
        <div className="absolute bottom-28 right-6 z-20 w-72 rounded-xl border border-white/15 bg-black/85 p-4 shadow-2xl backdrop-blur">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
            Up Next{dur ? ` · ${Math.max(0, Math.ceil((dur - time) / 1000))}s` : ''}
          </p>
          <p className="mb-3 truncate text-sm font-medium text-white">{st.upNext.label}</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.plex.playback.next()}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Play Now
            </button>
            <button
              onClick={() => window.plex.playback.cancelUpNext()}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Skip intro/credits prompt */}
      {st.skip && visible && (
        <button
          onClick={() => window.plex.playback.skip()}
          className="absolute bottom-32 right-6 z-20 rounded-lg bg-white/90 px-5 py-2.5 font-semibold text-black shadow-lg transition hover:bg-white"
        >
          Skip {st.skip.kind === 'credits' ? 'Credits' : 'Intro'} ⏭
        </button>
      )}

      {menu === 'settings' && visible && (
        <SettingsPanel
          audio={audio}
          subs={subs}
          quality={st.quality ?? 'original'}
          speed={st.speed ?? 1}
          subScale={st.subScale ?? 1}
          onSpeed={(n) => window.plex.playback.setSpeed(n)}
          onSubScale={(n) => window.plex.playback.setSubScale(n)}
          onQuality={(id) => window.plex.playback.setQuality(id)}
          onAudio={async (id) => {
            await window.plex.playback.selectAudio(id)
            setAudio(await window.plex.playback.audioTracks())
          }}
          onSub={async (opt) => {
            await window.plex.playback.selectSubtitle(opt)
            setSubs(await window.plex.playback.subtitleOptions())
          }}
          refreshSubs={async () => setSubs(await window.plex.playback.subtitleOptions())}
        />
      )}

      {/* Bottom control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-6 pb-5 pt-16 transition-opacity ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Seek bar */}
        <div className="mb-3 flex items-center gap-3 text-xs text-white">
          <span className="tabular-nums">{fmt(time)}</span>
          <input
            type="range"
            min={0}
            max={dur || 1}
            value={time}
            // Capture the pointer on press so the matching release/lost-capture
            // is GUARANTEED to fire on this element — even when the mouse is let
            // go over the mpv video (a native child window that otherwise eats
            // the event). That release is the single, reliable commit point.
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              draggingRef.current = true
            }}
            onChange={(e) => {
              const v = Number(e.target.value)
              scrubRef.current = v
              setScrub(v)
            }}
            onPointerUp={commitScrub}
            onLostPointerCapture={commitScrub}
            onKeyUp={commitScrub}
            className="h-1 flex-1 cursor-pointer accent-[rgb(var(--accent))]"
          />
          <span className="tabular-nums">{fmt(dur)}</span>
        </div>

        {/* Three-column row: transport centered, settings right. */}
        <div className="grid grid-cols-3 items-center text-white">
          <div />
          <div className="flex items-center justify-center gap-5">
            {st.hasPrev && (
              <Ctrl onClick={() => window.plex.playback.prev()} title="Previous episode">
                <Icon name="prev" className="h-6 w-6" />
              </Ctrl>
            )}
            <Ctrl onClick={() => window.plex.playback.seekBy(-10)} title="Back 10s">
              <Icon name="back10" className="h-7 w-7" />
            </Ctrl>
            <button
              onClick={() => window.plex.playback.playPause()}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow hover:brightness-110"
              title="Play/Pause (Space)"
              aria-label="Play/Pause"
            >
              <Icon name={st.paused ? 'play' : 'pause'} className="h-6 w-6" />
            </button>
            <Ctrl onClick={() => window.plex.playback.seekBy(30)} title="Forward 30s">
              <Icon name="forward30" className="h-7 w-7" />
            </Ctrl>
            {st.hasNext && (
              <Ctrl onClick={() => window.plex.playback.next()} title="Next episode">
                <Icon name="next" className="h-6 w-6" />
              </Ctrl>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <div className="group/vol flex items-center gap-2">
              <Ctrl
                onClick={() => window.plex.playback.setVolume((st.volume ?? 100) > 0 ? 0 : 100)}
                title="Mute"
              >
                {(st.volume ?? 100) === 0 ? '🔇' : '🔊'}
              </Ctrl>
              <input
                type="range"
                min={0}
                max={130}
                value={st.volume ?? 100}
                onChange={(e) => window.plex.playback.setVolume(Number(e.target.value))}
                className="h-1 w-24 cursor-pointer accent-[rgb(var(--accent))]"
                title={`Volume ${st.volume ?? 100}%`}
              />
            </div>
            <Ctrl onClick={openSettings} title="Audio, Subtitles & Quality">
              ⚙
            </Ctrl>
            <Ctrl onClick={() => window.plex.playback.togglePip()} title="Picture-in-picture (P)">
              <Icon name="pip" className="h-5 w-5" />
            </Ctrl>
            <Ctrl onClick={() => window.plex.playback.toggleFullscreen()} title="Fullscreen (F)">
              <Icon name="fullscreen" className="h-5 w-5" />
            </Ctrl>
          </div>
        </div>
      </div>
    </div>
  )
}

function Ctrl({
  children,
  onClick,
  title
}: {
  children: ReactNode
  onClick: () => void
  title: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg text-white/90 transition hover:bg-white/15"
    >
      {children}
    </button>
  )
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SUB_SIZES: { label: string; value: number }[] = [
  { label: 'S', value: 0.8 },
  { label: 'M', value: 1 },
  { label: 'L', value: 1.3 },
  { label: 'XL', value: 1.6 }
]

function SettingsPanel({
  audio,
  subs,
  quality,
  speed,
  subScale,
  onSpeed,
  onSubScale,
  onQuality,
  onAudio,
  onSub,
  refreshSubs
}: {
  audio: MediaTrack[]
  subs: SubtitleOption[]
  quality: string
  speed: number
  subScale: number
  onSpeed: (n: number) => void
  onSubScale: (n: number) => void
  onQuality: (id: string) => void
  onAudio: (id: number) => void
  onSub: (opt: SubtitleOption) => void
  refreshSubs: () => void
}): JSX.Element {
  return (
    <div className="absolute bottom-24 right-6 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-white/10 bg-black/85 p-4 text-sm text-white shadow-2xl backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Speed</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            onClick={() => onSpeed(sp)}
            className={`rounded-md px-2.5 py-1 text-xs transition hover:bg-white/10 ${
              Math.abs(speed - sp) < 0.01 ? 'bg-accent/30 text-accent' : 'text-white'
            }`}
          >
            {sp === 1 ? 'Normal' : `${sp}×`}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        Subtitle size
      </p>
      <div className="mb-4 flex gap-1.5">
        {SUB_SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => onSubScale(s.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs transition hover:bg-white/10 ${
              Math.abs(subScale - s.value) < 0.01 ? 'bg-accent/30 text-accent' : 'text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Quality</p>
      <div className="mb-4 max-h-40 overflow-y-auto">
        {QUALITIES.map((qu) => (
          <button
            key={qu.id}
            onClick={() => onQuality(qu.id)}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left transition hover:bg-white/10 ${
              quality === qu.id ? 'text-accent' : 'text-white'
            }`}
          >
            {quality === qu.id ? '● ' : ''}
            {qu.label}
          </button>
        ))}
      </div>

      <MediaInfoSection />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Audio</p>
      <div className="mb-4 max-h-40 overflow-y-auto">
        {audio.length === 0 && <p className="text-white/50">No audio tracks</p>}
        {audio.map((t) => (
          <button
            key={t.id}
            onClick={() => onAudio(t.id)}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left transition hover:bg-white/10 ${
              t.selected ? 'text-accent' : 'text-white'
            }`}
          >
            {t.selected ? '● ' : ''}
            {[t.lang?.toUpperCase(), t.title, t.codec?.toUpperCase()].filter(Boolean).join(' · ') ||
              `Track ${t.id}`}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Subtitles</p>
      <div className="max-h-40 overflow-y-auto">
        {subs.map((o) => (
          <button
            key={o.key}
            onClick={() => onSub(o)}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left transition hover:bg-white/10 ${
              o.selected ? 'text-accent' : 'text-white'
            }`}
          >
            {o.selected ? '● ' : ''}
            {o.label}
          </button>
        ))}
      </div>

      <OnlineSubs refreshSubs={refreshSubs} />
    </div>
  )
}

/** Format a kbps value as kbps or Mbps. */
function fmtRate(kbps?: number): string | undefined {
  if (!kbps || kbps <= 0) return undefined
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`
}

/** Collapsible "Media Info" section showing the live stream's technical details. */
function MediaInfoSection(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setInfo(await window.plex.playback.mediaInfo())
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = (): void => {
    const next = !open
    setOpen(next)
    if (next) void load()
  }

  const rows: [string, string | undefined][] = info
    ? [
        ['Playback', `${info.playbackMethod}${info.quality ? ` · ${info.quality}` : ''}`],
        ['Resolution', info.resolution],
        [
          'Video',
          [info.videoCodec, info.fps ? `${info.fps} fps` : undefined].filter(Boolean).join(' · ') ||
            undefined
        ],
        ['Video rate', fmtRate(info.videoBitrateKbps)],
        ['Audio', [info.audioCodec, info.audioChannels].filter(Boolean).join(' · ') || undefined],
        ['Audio rate', fmtRate(info.audioBitrateKbps)],
        ['Container', info.container],
        ['Decoder', info.hwDecode]
      ]
    : []
  const shown = rows.filter(([, v]) => v)

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        className="mb-2 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50 transition hover:text-white/80"
      >
        <span>Media Info</span>
        <span className="text-white/40">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-1 rounded-md bg-white/5 p-2">
          {loading && <p className="text-xs text-white/50">Reading stream…</p>}
          {!loading && shown.length === 0 && (
            <p className="text-xs text-white/50">No stream info available.</p>
          )}
          {!loading &&
            shown.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-xs">
                <span className="text-white/50">{k}</span>
                <span className="text-right text-white/90">{v}</span>
              </div>
            ))}
          {!loading && shown.length > 0 && (
            <button
              onClick={() => void load()}
              className="mt-1 text-[11px] text-accent transition hover:underline"
            >
              Refresh
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** On-demand OpenSubtitles search/download for the current item. */
function OnlineSubs({ refreshSubs }: { refreshSubs: () => void }): JSX.Element {
  const [results, setResults] = useState<{ key: string; title: string; lang?: string }[] | null>(
    null
  )
  const [busy, setBusy] = useState(false)

  const search = async (): Promise<void> => {
    setBusy(true)
    try {
      setResults(await window.plex.playback.searchSubtitles())
    } finally {
      setBusy(false)
    }
  }
  const download = async (key: string): Promise<void> => {
    setBusy(true)
    try {
      await window.plex.playback.downloadSubtitle(key)
      refreshSubs()
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <button
        onClick={search}
        disabled={busy}
        className="w-full rounded-md px-2 py-1.5 text-left text-accent transition hover:bg-white/10 disabled:opacity-50"
      >
        🔍 {busy ? 'Searching…' : 'Search subtitles online'}
      </button>
      {results && (
        <div className="mt-1 max-h-40 overflow-y-auto">
          {results.length === 0 && (
            <p className="px-2 py-1 text-xs text-white/50">No results (needs Plex Pass + agent).</p>
          )}
          {results.map((r) => (
            <button
              key={r.key}
              onClick={() => download(r.key)}
              disabled={busy}
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-white transition hover:bg-white/10 disabled:opacity-50"
              title={r.title}
            >
              ⬇ {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
