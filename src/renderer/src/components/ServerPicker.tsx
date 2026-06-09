import { useQuery } from '@tanstack/react-query'
import type { PlexServer } from '@shared/types'

interface Props {
  onSelect: (server: PlexServer) => void
}

/** Server-selection screen: discover servers and let the user pick one. */
export function ServerPicker({ onSelect }: Props): JSX.Element {
  const { data: servers, isLoading, isError } = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.plex.servers.list(),
    staleTime: 60_000
  })

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <h2 className="mb-1 text-2xl font-bold">Your servers</h2>
      <p className="mb-8 text-sm text-ink-muted">
        Choose a server to browse. Connectivity is probed automatically.
      </p>

      {isLoading && (
        <div className="flex items-center gap-3 text-ink-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-muted border-t-accent" />
          <span className="text-sm">Discovering servers…</span>
        </div>
      )}

      {isError && <p className="text-sm text-red-400">Failed to load servers.</p>}

      {servers && servers.length === 0 && (
        <p className="text-sm text-ink-muted">No servers found on this account.</p>
      )}

      {servers && servers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {servers.map((server) => (
            <ServerCard key={server.clientIdentifier} server={server} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

function ServerCard({
  server,
  onSelect
}: {
  server: PlexServer
  onSelect: (s: PlexServer) => void
}): JSX.Element {
  const reachable = server.bestConnection !== null
  const conn = server.bestConnection
  const locality = conn?.local ? 'Local' : conn?.relay ? 'Relay' : 'Remote'

  return (
    <button
      disabled={!reachable}
      onClick={() => onSelect(server)}
      className="group flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-surface-raised/60 p-5 text-left transition enabled:hover:border-accent/60 enabled:hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-lg font-semibold">{server.name}</span>
        <span
          className={`h-2.5 w-2.5 rounded-full ${reachable ? 'bg-emerald-400' : 'bg-red-400'}`}
          title={reachable ? 'Reachable' : 'Unreachable'}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
        {server.owned && <Badge>Owned</Badge>}
        <Badge>{server.product}</Badge>
        {reachable && <Badge>{locality}</Badge>}
      </div>
      {!reachable && (
        <span className="text-xs text-ink-muted">No reachable connection</span>
      )}
    </button>
  )
}

function Badge({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {children}
    </span>
  )
}
