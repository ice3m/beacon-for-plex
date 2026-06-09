import { useState } from 'react'
import type { SectionFilter } from '@shared/types'
import { useFilterValues } from '../lib/hooks'

/** One active filter selection. */
export interface ActiveFilter {
  key: string // query param, e.g. 'genre'
  value: string // value id
  label: string // display, e.g. "Genre: Action"
}

interface Props {
  serverId: string
  filters: SectionFilter[]
  active: ActiveFilter[]
  onChange: (active: ActiveFilter[]) => void
}

/** A row of filter dropdowns/toggles plus removable chips for active filters. */
export function FilterBar({ serverId, filters, active, onChange }: Props): JSX.Element {
  const setFilter = (key: string, value: string, label: string): void => {
    // One value per filter key (replace any existing for that key).
    onChange([...active.filter((a) => a.key !== key), { key, value, label }])
  }
  const clearFilter = (key: string): void => onChange(active.filter((a) => a.key !== key))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) =>
          f.filterType === 'boolean' ? (
            <button
              key={f.filter}
              onClick={() =>
                active.some((a) => a.key === f.filter)
                  ? clearFilter(f.filter)
                  : setFilter(f.filter, '1', f.title)
              }
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active.some((a) => a.key === f.filter)
                  ? 'border-accent bg-accent/20 text-ink'
                  : 'border-white/15 text-ink-muted hover:bg-white/5'
              }`}
            >
              {f.title}
            </button>
          ) : (
            <FilterDropdown
              key={f.filter}
              serverId={serverId}
              filter={f}
              onPick={(value, valueTitle) =>
                setFilter(f.filter, value, `${f.title}: ${valueTitle}`)
              }
            />
          )
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((a) => (
            <span
              key={a.key}
              className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs text-ink"
            >
              {a.label}
              <button
                onClick={() => clearFilter(a.key)}
                className="text-ink-muted hover:text-ink"
                aria-label={`Remove ${a.label}`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs text-ink-muted underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterDropdown({
  serverId,
  filter,
  onPick
}: {
  serverId: string
  filter: SectionFilter
  onPick: (value: string, title: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data: values, isLoading } = useFilterValues(serverId, filter.key, open)

  const filtered = (values ?? []).filter((v) =>
    q ? v.title.toLowerCase().includes(q.toLowerCase()) : true
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-ink-muted transition hover:bg-white/5"
      >
        {filter.title} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-surface-raised p-2 shadow-2xl">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Filter ${filter.title.toLowerCase()}…`}
              className="mb-2 w-full rounded-md border border-white/10 bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            {isLoading && <p className="px-2 py-1 text-xs text-ink-muted">Loading…</p>}
            {filtered.map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  onPick(v.key, v.title)
                  setOpen(false)
                }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-ink transition hover:bg-white/10"
              >
                {v.title}
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <p className="px-2 py-1 text-xs text-ink-muted">No options.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
