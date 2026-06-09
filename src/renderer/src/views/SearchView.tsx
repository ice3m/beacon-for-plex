import { useSearch } from '../lib/hooks'
import { HubRow } from '../components/HubRow'
import { Loading, ErrorState } from '../components/States'

interface Props {
  serverId: string
  query: string
}

/** Global search results, grouped into hubs by type (Movies, Shows, …). */
export function SearchView({ serverId, query }: Props): JSX.Element {
  const { data: hubs, isLoading, isError, error, isFetching } = useSearch(serverId, query)

  return (
    <div className="py-6">
      <h1 className="mb-1 px-8 text-2xl font-bold">
        Results for “{query}”
        {isFetching && <span className="ml-3 align-middle text-sm text-ink-muted">searching…</span>}
      </h1>

      {isLoading && <Loading label="Searching…" />}
      {isError && <ErrorState message={(error as Error)?.message ?? 'Search failed'} />}

      {hubs && hubs.length === 0 && !isFetching && (
        <p className="px-8 py-10 text-ink-muted">No results found.</p>
      )}

      <div className="mt-4">
        {hubs?.map((hub) => (
          <HubRow key={hub.hubIdentifier} serverId={serverId} title={hub.title} items={hub.items} />
        ))}
      </div>
    </div>
  )
}
