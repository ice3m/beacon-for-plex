import { useCollectionItems } from '../lib/hooks'
import { MediaCard } from '../components/MediaCard'
import { SkeletonGrid } from '../components/Skeleton'
import { ErrorState } from '../components/States'

interface Props {
  serverId: string
  ratingKey: string
  title: string
}

/** Items inside a single collection. */
export function CollectionView({ serverId, ratingKey, title }: Props): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useCollectionItems(serverId, ratingKey)

  return (
    <div className="py-6">
      <h1 className="mb-6 px-8 text-3xl font-bold">{title}</h1>

      {isLoading && <SkeletonGrid />}
      {isError && (
        <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => refetch()} />
      )}

      {data && (
        <>
          <p className="mb-4 px-8 text-sm text-ink-muted">{data.length} items</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 px-8">
            {data.map((item) => (
              <MediaCard key={item.ratingKey} serverId={serverId} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
