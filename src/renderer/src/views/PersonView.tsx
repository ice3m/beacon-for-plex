import { useByActor } from '../lib/hooks'
import { MediaCard } from '../components/MediaCard'
import { SkeletonGrid } from '../components/Skeleton'
import { ErrorState } from '../components/States'

interface Props {
  serverId: string
  personId: string
  name: string
  sectionId: string
}

/** A person's filmography within a library (actor-filtered). */
export function PersonView({ serverId, personId, name, sectionId }: Props): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useByActor(serverId, sectionId, personId)

  return (
    <div className="py-6">
      <p className="px-8 text-sm text-ink-muted">Appearances</p>
      <h1 className="mb-6 px-8 text-3xl font-bold">{name}</h1>

      {isLoading && <SkeletonGrid />}
      {isError && (
        <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => refetch()} />
      )}
      {data && data.length === 0 && (
        <p className="px-8 text-ink-muted">No titles found for {name} in this library.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 px-8">
        {data?.map((item) => (
          <MediaCard key={item.ratingKey} serverId={serverId} item={item} />
        ))}
      </div>
    </div>
  )
}
