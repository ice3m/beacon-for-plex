/** Small shared loading / error / empty presentational helpers. */

export function Loading({ label }: { label?: string }): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center gap-3 py-20 text-ink-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-muted border-t-accent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry
}: {
  message: string
  onRetry?: () => void
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-sm text-red-400">{message}</p>
      <p className="text-xs text-ink-muted">The server may be unreachable.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Retry
        </button>
      )}
    </div>
  )
}
