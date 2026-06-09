import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PlexMediaItem } from '@shared/types'
import { imageUrl } from '@shared/ipc'
import {
  useCurrentAccount,
  useHiddenHistoryUsers,
  useHistory,
  useServerAccounts
} from '../lib/hooks'
import { useNav } from '../state/nav'
import { Loading, ErrorState } from '../components/States'

// Plex reports viewedAt/lastViewedAt in epoch SECONDS.
function dayBucket(tsSec?: number): string {
  if (!tsSec) return 'Older'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const ms = tsSec * 1000
  const day = 86_400_000
  if (ms >= startOfToday) return 'Today'
  if (ms >= startOfToday - day) return 'Yesterday'
  if (ms >= startOfToday - 7 * day) return 'Earlier this week'
  if (ms >= startOfToday - 30 * day) return 'Earlier this month'
  return 'Older'
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier this month', 'Older']

function ago(tsSec?: number): string {
  if (!tsSec) return ''
  const diff = Date.now() / 1000 - tsSec
  if (diff < 90) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`
  const d = Math.round(diff / 86_400)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

/** Recently watched items, grouped by day and shown as uniform landscape cards.
 * History is per-user; a dropdown filters by server account (defaults to me). */
export function HistoryView({ serverId }: { serverId: string }): JSX.Element {
  const qc = useQueryClient()
  const { data: accounts } = useServerAccounts(serverId)
  const { data: me } = useCurrentAccount()
  const { data: hidden } = useHiddenHistoryUsers()
  // null = All Users; a number = a specific account id.
  const [accountId, setAccountId] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const hiddenSet = useMemo(() => new Set(hidden ?? []), [hidden])
  const visibleAccounts = useMemo(
    () => (accounts ?? []).filter((a) => !hiddenSet.has(a.id)),
    [accounts, hiddenSet]
  )

  // Default the filter to the signed-in user once accounts + account load.
  useEffect(() => {
    if (touched || !accounts || !me) return
    const lc = (s?: string | null): string => (s ?? '').toLowerCase()
    const mine = accounts.find(
      (a) => lc(a.name) === lc(me.username) || lc(a.name) === lc(me.title)
    )
    if (mine && !hiddenSet.has(mine.id)) setAccountId(mine.id)
  }, [accounts, me, touched, hiddenSet])

  // If the currently-selected user gets hidden, fall back to All Users.
  useEffect(() => {
    if (accountId != null && hiddenSet.has(accountId)) setAccountId(null)
  }, [accountId, hiddenSet])

  const { data, isLoading, isError, error, refetch } = useHistory(serverId, accountId ?? undefined)

  const toggleHidden = async (id: number, hide: boolean): Promise<void> => {
    await window.plex.library.setHistoryUserHidden(id, hide)
    await qc.invalidateQueries({ queryKey: ['hiddenHistoryUsers'] })
  }

  const groups = useMemo(() => {
    const map = new Map<string, PlexMediaItem[]>()
    for (const item of data ?? []) {
      const key = dayBucket(item.lastViewedAt)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => [b, map.get(b)!] as const)
  }, [data])

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 px-8">
        <h1 className="mr-auto text-3xl font-bold">Recently Watched</h1>
        {accounts && accounts.length > 1 && (
          <>
            <select
              value={accountId ?? 'all'}
              onChange={(e) => {
                setTouched(true)
                setAccountId(e.target.value === 'all' ? null : Number(e.target.value))
              }}
              className="shrink-0 rounded-lg border border-white/10 bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="all">All Users</option>
              {visibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div className="relative shrink-0">
              <button
                onClick={() => setManageOpen((v) => !v)}
                title="Show/hide users"
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink"
              >
                Manage
              </button>
              {manageOpen && (
                <div className="absolute right-0 z-30 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-white/10 bg-surface-raised p-2 shadow-2xl">
                  <p className="px-2 py-1 text-xs text-ink-muted">Show in the user filter:</p>
                  {accounts.map((a) => {
                    const isHidden = hiddenSet.has(a.id)
                    return (
                      <button
                        key={a.id}
                        onClick={() => void toggleHidden(a.id, !isHidden)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/10"
                      >
                        <span className={`truncate ${isHidden ? 'text-ink-muted' : 'text-ink'}`}>
                          {a.name}
                        </span>
                        <span className={isHidden ? 'text-ink-muted' : 'text-accent'}>
                          {isHidden ? '○' : '●'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isLoading && <Loading label="Loading history…" />}
      {isError && (
        <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => refetch()} />
      )}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <p className="px-8 text-ink-muted">Nothing watched yet.</p>
      )}

      {groups.map(([bucket, items]) => (
        <section key={bucket} className="mb-8">
          <h2 className="mb-3 px-8 text-sm font-semibold uppercase tracking-wider text-ink-muted">
            {bucket}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-5 px-8">
            {items.map((item, i) => (
              <HistoryCard key={`${item.ratingKey}-${i}`} serverId={serverId} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function HistoryCard({ serverId, item }: { serverId: string; item: PlexMediaItem }): JSX.Element {
  const { navigate } = useNav()
  const [imgFailed, setImgFailed] = useState(false)
  const isEpisode = item.type === 'episode'

  // Always landscape: episode still, else the movie/show backdrop.
  const art = isEpisode
    ? (item.thumb ?? item.grandparentThumb)
    : (item.art ?? item.thumb ?? item.grandparentThumb)
  const src = imageUrl(serverId, art, { width: 440, height: 248 })

  const primary = isEpisode ? (item.grandparentTitle ?? item.title) : item.title
  const secondary = isEpisode
    ? [
        item.parentIndex != null && item.index != null ? `S${item.parentIndex} · E${item.index}` : null,
        item.title
      ]
        .filter(Boolean)
        .join(' · ')
    : item.year
      ? String(item.year)
      : ''

  return (
    <button
      onClick={() => navigate({ name: 'detail', ratingKey: item.ratingKey })}
      className="group flex flex-col gap-2 text-left focus:outline-none"
    >
      <div
        className="relative overflow-hidden rounded-lg bg-surface-raised ring-1 ring-white/5 transition group-hover:ring-2 group-hover:ring-accent"
        style={{ aspectRatio: '16 / 9' }}
      >
        {src && !imgFailed ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-muted">
            {item.title}
          </div>
        )}
        <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
          {ago(item.lastViewedAt)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{primary}</p>
        {secondary && <p className="truncate text-xs text-ink-muted">{secondary}</p>}
      </div>
    </button>
  )
}
