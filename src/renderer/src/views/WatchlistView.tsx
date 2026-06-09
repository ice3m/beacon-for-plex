import type { PlexMediaItem } from '@shared/types'
import { useWatchlist } from '../lib/hooks'
import { MediaCard } from '../components/MediaCard'
import { Loading } from '../components/States'

/** The personal "My List" — items the user saved to watch later. */
export function WatchlistView({ serverId }: { serverId: string }): JSX.Element {
  const { data, isLoading } = useWatchlist(serverId)

  if (isLoading) return <Loading label="Loading your list…" />

  return (
    <div className="py-6">
      <h1 className="mb-6 px-8 text-3xl font-bold">My List</h1>
      {(!data || data.length === 0) && (
        <p className="px-8 text-ink-muted">
          Your list is empty. Tap “＋ My List” on any movie or show to save it here.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 px-8">
        {data?.map((entry) => (
          <MediaCard key={entry.ratingKey} serverId={serverId} item={entry as PlexMediaItem} fill />
        ))}
      </div>
    </div>
  )
}
