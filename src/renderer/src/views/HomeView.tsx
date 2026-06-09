import type { PlexLibrarySection } from '@shared/types'
import { useOnDeck, useRecentlyAdded, useSections } from '../lib/hooks'
import { HubRow } from '../components/HubRow'
import { CantChooseRow } from '../components/CantChooseRow'
import { ContinueCard } from '../components/ContinueCard'
import { HeroBanner } from '../components/HeroBanner'
import { SkeletonRows } from '../components/Skeleton'
import { ErrorState } from '../components/States'
import { useShowHero } from '../lib/appPrefs'

/**
 * Home pane: a featured hero, Continue Watching, then a "What's New" row per
 * library. TV libraries surface shows that gained new episodes (Last Episode
 * Added), so existing shows resurface — not just brand-new ones.
 */
export function HomeView({ serverId }: { serverId: string }): JSX.Element {
  const { data: sections, isLoading, isError, error, refetch } = useSections(serverId)
  const { data: onDeck } = useOnDeck(serverId)
  const showHero = useShowHero()

  const visible = sections?.filter((s) => !s.hidden) ?? []
  const heroSection = visible[0]
  // Hero spotlights the first library's newest additions.
  const { data: heroItems } = useRecentlyAdded(
    serverId,
    heroSection?.key ?? '',
    heroSection?.type ?? ''
  )

  if (isLoading) return <SkeletonRows count={4} />
  if (isError)
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => refetch()} />

  const hasContinue = (onDeck?.length ?? 0) > 0

  return (
    <div className="pb-6">
      {showHero && heroItems && heroItems.length > 0 && (
        <HeroBanner serverId={serverId} items={heroItems} />
      )}

      <h1 className="mb-6 px-8 text-3xl font-bold">Home</h1>

      {hasContinue && (
        <HubRow
          serverId={serverId}
          title="Continue Watching"
          items={onDeck ?? []}
          renderItem={(item) => <ContinueCard serverId={serverId} item={item} />}
        />
      )}

      <div className="mb-8 mt-2">
        <CantChooseRow serverId={serverId} />
      </div>

      {visible.map((section) => (
        <LibraryNewRow key={section.key} serverId={serverId} section={section} />
      ))}

      {!hasContinue && visible.length === 0 && (
        <p className="px-8 text-ink-muted">Nothing to show yet.</p>
      )}
    </div>
  )
}

/** A single library's "What's New" row. */
function LibraryNewRow({
  serverId,
  section
}: {
  serverId: string
  section: PlexLibrarySection
}): JSX.Element | null {
  const { data } = useRecentlyAdded(serverId, section.key, section.type)
  if (!data || data.length === 0) return null
  const title =
    section.type === 'show' ? `New Episodes — ${section.title}` : `New in ${section.title}`
  return <HubRow serverId={serverId} title={title} items={data} />
}
