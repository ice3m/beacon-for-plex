import { imageUrl } from '@shared/ipc'
import { useCollections } from '../lib/hooks'
import { useNav } from '../state/nav'
import { SkeletonGrid } from '../components/Skeleton'
import { ErrorState } from '../components/States'

interface Props {
  serverId: string
  sectionId: string
  title: string
}

/** Grid of a library's collections. */
export function CollectionsView({ serverId, sectionId, title }: Props): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useCollections(serverId, sectionId)
  const { navigate } = useNav()

  return (
    <div className="py-6">
      <h1 className="mb-6 px-8 text-3xl font-bold">{title} · Collections</h1>

      {isLoading && <SkeletonGrid />}
      {isError && (
        <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => refetch()} />
      )}
      {data && data.length === 0 && (
        <p className="px-8 text-ink-muted">This library has no collections.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 px-8">
        {data?.map((c) => {
          const src = imageUrl(serverId, c.thumb, { width: 300, height: 450 })
          return (
            <button
              key={c.ratingKey}
              onClick={() => navigate({ name: 'collection', ratingKey: c.ratingKey, title: c.title })}
              className="group flex flex-col gap-2 text-left"
            >
              <div
                className="relative overflow-hidden rounded-md bg-surface-raised ring-1 ring-white/5 transition group-hover:ring-2 group-hover:ring-accent"
                style={{ aspectRatio: '2 / 3' }}
              >
                {src ? (
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-xs text-ink-muted">
                    {c.title}
                  </div>
                )}
                {c.childCount != null && (
                  <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px]">
                    {c.childCount}
                  </div>
                )}
              </div>
              <p className="truncate text-sm font-medium" style={{ width: 150 }}>
                {c.title}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
