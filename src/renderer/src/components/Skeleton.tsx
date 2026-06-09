/** Shimmer placeholders shown while content loads (feels faster than a spinner). */

function Poster({ width = 150 }: { width?: number }): JSX.Element {
  return (
    <div className="flex shrink-0 flex-col gap-2" style={{ width }}>
      <div className="skeleton rounded-md" style={{ aspectRatio: '2 / 3' }} />
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="skeleton h-2.5 w-1/2 rounded" />
    </div>
  )
}

/** A titled row of placeholder posters. */
export function SkeletonRow(): JSX.Element {
  return (
    <div className="mb-8">
      <div className="skeleton mb-3 ml-8 h-5 w-48 rounded" />
      <div className="flex gap-3 overflow-hidden px-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Poster key={i} />
        ))}
      </div>
    </div>
  )
}

/** Several skeleton rows for a loading Home screen. */
export function SkeletonRows({ count = 3 }: { count?: number }): JSX.Element {
  return (
    <div className="py-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

/** A grid of placeholder posters for a loading library. */
export function SkeletonGrid(): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-6 px-8">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton rounded-md" style={{ aspectRatio: '2 / 3' }} />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-2.5 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}
