import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  CacheProgress,
  PlaybackPrefs,
  PlexLibrarySection,
  ServerSetting
} from '@shared/types'
import {
  usePlaybackPrefs,
  useSections,
  useServerPrefs,
  useSetLibraryHidden,
  useSetLibraryOrder,
  useSetPlaybackPrefs,
  useSetServerPref
} from '../lib/hooks'
import { formatBytes } from '../lib/format'
import { applyTheme, getStoredThemeId, THEMES } from '../lib/themes'
import { getShowHero, setShowHero, useShowHero } from '../lib/appPrefs'
import { QUALITIES } from '@shared/quality'
import { IconPicker } from '../components/IconPicker'
import { LibraryGlyph } from '../components/icons'
import { Loading, ErrorState } from '../components/States'

interface Props {
  serverId: string
  owned: boolean
}

// The transcoder/hardware settings the user cares about live in this group.
const TRANSCODER_GROUP = 'transcoder'

/**
 * Settings: appearance/themes (everyone) plus the server's Transcoder
 * preferences — including hardware-acceleration and HEVC toggles — read live
 * from /:/prefs and writable by the server owner.
 */
const TAB_KEY = 'plex-settings-tab'

const TAB_DEFS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'playback', label: 'Playback' },
  { id: 'libraries', label: 'Libraries' },
  { id: 'cache', label: 'Offline Cache' },
  { id: 'server', label: 'Server' }
] as const

export function SettingsView({ serverId, owned }: Props): JSX.Element {
  const [tab, setTab] = useState(() => localStorage.getItem(TAB_KEY) ?? 'appearance')

  const select = (id: string): void => {
    setTab(id)
    localStorage.setItem(TAB_KEY, id)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      <div className="mb-8 flex gap-1 border-b border-white/10">
        {TAB_DEFS.map((t) => (
          <button
            key={t.id}
            onClick={() => select(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'appearance' && <ThemeSection />}
      {tab === 'playback' && <PlaybackSection />}
      {tab === 'libraries' && <LibrariesSection serverId={serverId} />}
      {tab === 'cache' && <CacheSection serverId={serverId} />}
      {tab === 'server' && <ServerSection serverId={serverId} owned={owned} />}
    </div>
  )
}

const LANGS: { code: string; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fre', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'kor', label: 'Korean' },
  { code: 'chi', label: 'Chinese' },
  { code: 'rus', label: 'Russian' },
  { code: 'hin', label: 'Hindi' },
  { code: 'ara', label: 'Arabic' }
]

/** Audio/subtitle language + surround preferences applied to playback. */
function PlaybackSection(): JSX.Element {
  const { data: prefs } = usePlaybackPrefs()
  const save = useSetPlaybackPrefs()
  if (!prefs) return <section className="mb-10" />

  const update = (patch: Partial<PlaybackPrefs>): void => save.mutate({ ...prefs, ...patch })

  return (
    <SettingsSection
      title="Playback"
      description="Preferred languages auto-select the right audio (incl. dubs) and subtitles when available."
    >
      <div className="space-y-4">
        <Row label="Preferred audio language" hint="Picks a matching dub when present.">
          <select
            value={prefs.audioLang}
            onChange={(e) => update({ audioLang: e.target.value })}
            className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Preferred subtitle language">
          <select
            value={prefs.subtitleLang}
            onChange={(e) => update({ subtitleLang: e.target.value })}
            className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Default quality" hint="Original = direct play (best). Lower options transcode.">
          <select
            value={prefs.defaultQuality}
            onChange={(e) => update({ defaultQuality: e.target.value })}
            className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {QUALITIES.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Show subtitles by default">
          <Toggle on={prefs.subtitlesOn} onClick={() => update({ subtitlesOn: !prefs.subtitlesOn })} />
        </Row>

        <Row
          label="Surround sound"
          hint="Preserve the original channel layout (5.1/7.1). Off = downmix to stereo."
        >
          <Toggle on={prefs.surround} onClick={() => update({ surround: !prefs.surround })} />
        </Row>

        <Row label="Auto-skip intro" hint="Automatically skip the intro when a marker exists.">
          <Toggle
            on={prefs.autoSkipIntro}
            onClick={() => update({ autoSkipIntro: !prefs.autoSkipIntro })}
          />
        </Row>

        <Row label="Always skip credits" hint="Automatically skip the credits when a marker exists.">
          <Toggle
            on={prefs.autoSkipCredits}
            onClick={() => update({ autoSkipCredits: !prefs.autoSkipCredits })}
          />
        </Row>

        <Row label="Auto-play next episode" hint="Start the next episode when one finishes.">
          <Toggle
            on={prefs.autoPlayNext}
            onClick={() => update({ autoPlayNext: !prefs.autoPlayNext })}
          />
        </Row>

        <Row
          label="Advertise as a Plex player"
          hint="Let your Plex phone/tablet app cast to this app (same network). Opens port 3005."
        >
          <Toggle
            on={prefs.advertiseAsPlayer}
            onClick={() => update({ advertiseAsPlayer: !prefs.advertiseAsPlayer })}
          />
        </Row>

        <Row
          label="Minimize to system tray"
          hint="When you close the window, keep the app running in the system tray instead of quitting."
        >
          <Toggle
            on={prefs.minimizeToTray}
            onClick={() => update({ minimizeToTray: !prefs.minimizeToTray })}
          />
        </Row>
      </div>
    </SettingsSection>
  )
}

/** A single Settings tab's content: a heading, optional blurb, then the body. */
function SettingsSection({
  title,
  description,
  children
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      {description && <p className="mb-4 text-sm text-ink-muted">{description}</p>}
      {children}
    </section>
  )
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-white/20'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

/** Manage which libraries appear in the sidebar, their order, and custom icons. */
function LibrariesSection({ serverId }: { serverId: string }): JSX.Element {
  const { data: sections } = useSections(serverId)
  const setHidden = useSetLibraryHidden(serverId)
  const setOrder = useSetLibraryOrder(serverId)
  const [editing, setEditing] = useState<PlexLibrarySection | null>(null)

  // Move the library at `index` up (-1) or down (+1) and persist the new order.
  const move = (index: number, dir: -1 | 1): void => {
    if (!sections) return
    const target = index + dir
    if (target < 0 || target >= sections.length) return
    const keys = sections.map((s) => s.key)
    ;[keys[index], keys[target]] = [keys[target], keys[index]]
    setOrder.mutate(keys)
  }

  return (
    <SettingsSection
      title="Libraries"
      description="Reorder, hide, or set a custom icon for each library in the sidebar."
    >
      <div className="space-y-1">
        {sections?.map((section, index) => (
          <div
            key={section.key}
            className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition hover:bg-white/5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex flex-col">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || setOrder.isPending}
                  aria-label="Move up"
                  className="px-1 text-xs leading-none text-ink-muted transition hover:text-ink disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1 || setOrder.isPending}
                  aria-label="Move down"
                  className="px-1 text-xs leading-none text-ink-muted transition hover:text-ink disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
              <span className="flex w-6 justify-center text-ink">
                <LibraryGlyph iconId={section.customIcon} type={section.type} />
              </span>
              <span className={`truncate text-sm ${section.hidden ? 'text-ink-muted' : 'text-ink'}`}>
                {section.title}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditing(section)}
                className="rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-white/10 hover:text-ink"
              >
                Icon
              </button>
              <button
                onClick={() =>
                  setHidden.mutate({ sectionId: section.key, hidden: !section.hidden })
                }
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  section.hidden
                    ? 'bg-white/10 text-ink-muted hover:bg-white/20'
                    : 'bg-accent/20 text-ink hover:bg-accent/30'
                }`}
              >
                {section.hidden ? 'Hidden' : 'Visible'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <IconPicker serverId={serverId} section={editing} onClose={() => setEditing(null)} />
      )}
    </SettingsSection>
  )
}

/**
 * Manual full-database artwork prewarm: downloads every library's posters and
 * backdrops to the on-disk cache so browsing is instant. Re-running only pulls
 * newly added items; live browsing still fetches anything uncached on demand.
 */
function CacheSection({ serverId }: { serverId: string }): JSX.Element {
  const [status, setStatus] = useState<CacheProgress | null>(null)
  const [sizes, setSizes] = useState<{ images: number; metadata: number } | null>(null)
  const [clearing, setClearing] = useState(false)

  const refreshSizes = (): void => {
    void window.plex.cache.size().then(setSizes)
  }

  useEffect(() => {
    let active = true
    window.plex.cache.getStatus().then((s) => active && setStatus(s))
    refreshSizes()
    const off = window.plex.cache.onStatus(setStatus)
    return () => {
      active = false
      off()
    }
  }, [])

  const running = status?.running ?? false

  // Refresh the on-disk size readout whenever a prewarm finishes.
  useEffect(() => {
    if (!running) refreshSizes()
  }, [running])

  const clearCache = async (): Promise<void> => {
    setClearing(true)
    try {
      await window.plex.cache.clear()
      refreshSizes()
    } finally {
      setClearing(false)
    }
  }
  const phase = status?.phase ?? 'Idle'
  const scanning = running && phase.startsWith('Scanning')
  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0
  const showBar =
    !!status &&
    (running || phase === 'Done' || phase === 'Cancelled' || phase.startsWith('Error'))

  const label = status?.currentLibrary && scanning ? `Scanning ${status.currentLibrary}…` : phase

  return (
    <SettingsSection
      title="Offline Cache"
      description="Pre-download all artwork so every library loads instantly. Safe to re-run anytime — it only fetches newly added items, and normal browsing still picks up anything new on its own."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.plex.cache.start(serverId).then(setStatus)}
            disabled={running}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {running ? 'Caching…' : 'Cache Full Database'}
          </button>
          {running && (
            <button
              onClick={() => window.plex.cache.cancel().then(setStatus)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-muted transition hover:bg-white/10"
            >
              Cancel
            </button>
          )}
        </div>

        {showBar && status && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              {scanning ? (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
              ) : (
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span>{label}</span>
              {status.total > 0 && !scanning && (
                <span>
                  {status.done} / {status.total} ({pct}%)
                </span>
              )}
            </div>
            {!running && phase === 'Done' && (
              <p className="mt-1 text-xs text-emerald-400">
                Done · {status.cached} new image{status.cached === 1 ? '' : 's'} cached,{' '}
                {status.skipped} already cached
                {status.errors > 0 ? ` · ${status.errors} skipped (errors)` : ''}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <p className="text-xs text-ink-muted">
            {sizes
              ? `On disk: ${formatBytes(sizes.images)} artwork · ${formatBytes(sizes.metadata)} details`
              : 'Calculating cache size…'}
          </p>
          <button
            onClick={clearCache}
            disabled={clearing || running}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-muted transition hover:bg-white/10 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear cache'}
          </button>
        </div>
      </div>
    </SettingsSection>
  )
}

function ThemeSection(): JSX.Element {
  const [active, setActive] = useState(getStoredThemeId)
  const showHero = useShowHero()

  const pick = (id: string): void => {
    applyTheme(id)
    setActive(id)
  }

  return (
    <SettingsSection
      title="Appearance"
      description="Pick a theme. Applies instantly across the app."
    >
      <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <p className="font-medium text-ink">Featured banner on Home</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Show the large rotating spotlight at the top of Home.
          </p>
        </div>
        <button
          onClick={() => setShowHero(!getShowHero())}
          role="switch"
          aria-checked={showHero}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            showHero ? 'bg-accent' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              showHero ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEMES.map((theme) => {
          const isActive = theme.id === active
          return (
            <button
              key={theme.id}
              onClick={() => pick(theme.id)}
              className={`overflow-hidden rounded-xl border text-left transition ${
                isActive ? 'border-accent ring-2 ring-accent' : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div
                className="flex h-16 items-center gap-2 px-3"
                style={{ background: `rgb(${theme.vars.surface})` }}
              >
                <span
                  className="h-6 w-6 rounded-full"
                  style={{ background: `rgb(${theme.vars.accent})` }}
                />
                <span
                  className="h-6 w-6 rounded-md"
                  style={{ background: `rgb(${theme.vars.surfaceRaised})` }}
                />
                <span
                  className="h-2 flex-1 rounded-full"
                  style={{ background: `rgb(${theme.vars.inkMuted})` }}
                />
              </div>
              <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
                <span className="text-sm font-medium">{theme.name}</span>
                {isActive && <span className="text-xs text-accent">●</span>}
              </div>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}

function ServerSection({ serverId, owned }: Props): JSX.Element {
  const { data: prefs, isLoading, isError, error } = useServerPrefs(serverId, owned)
  const setPref = useSetServerPref(serverId)

  return (
    <SettingsSection
      title="Server — Transcoder & Hardware"
      description={
        <>
          Applied to the Plex Media Server itself.
          {!owned && ' Only the server owner can change these.'}
        </>
      }
    >
      {!owned ? null : isLoading ? (
        <Loading label="Loading server settings…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? 'Failed to load'} />
      ) : (
        (() => {
          const transcoder = (prefs ?? []).filter(
            (p) => p.group === TRANSCODER_GROUP && !p.hidden
          )
          if (transcoder.length === 0)
            return <p className="text-sm text-ink-muted">No transcoder settings exposed.</p>
          return (
            <div className="space-y-1">
              {transcoder.map((setting) => (
                <SettingRow
                  key={setting.id}
                  setting={setting}
                  pending={setPref.isPending}
                  onChange={(value) => setPref.mutate({ id: setting.id, value })}
                />
              ))}
            </div>
          )
        })()
      )}
    </SettingsSection>
  )
}

function SettingRow({
  setting,
  pending,
  onChange
}: {
  setting: ServerSetting
  pending: boolean
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{setting.label}</p>
        {setting.summary && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{setting.summary}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <SettingControl setting={setting} pending={pending} onChange={onChange} />
      </div>
    </div>
  )
}

function SettingControl({
  setting,
  pending,
  onChange
}: {
  setting: ServerSetting
  pending: boolean
  onChange: (value: string) => void
}): JSX.Element {
  if (setting.type === 'bool') {
    const on = setting.value === 'true' || setting.value === '1'
    return (
      <button
        disabled={pending}
        onClick={() => onChange(on ? 'false' : 'true')}
        className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
          on ? 'bg-accent' : 'bg-white/20'
        }`}
        role="switch"
        aria-checked={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    )
  }

  if (setting.enumValues && setting.enumValues.length > 0) {
    return (
      <select
        disabled={pending}
        value={setting.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
      >
        {setting.enumValues.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      defaultValue={setting.value}
      disabled={pending}
      onBlur={(e) => e.target.value !== setting.value && onChange(e.target.value)}
      className="w-40 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
    />
  )
}
