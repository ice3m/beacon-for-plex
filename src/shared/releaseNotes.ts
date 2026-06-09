/**
 * Per-version "What's New" notes, shown once after the app updates to a given
 * version (see `updates.whatsNew`). Add a new entry for each release; keep each
 * item short and user-facing (a single fix/change per bullet).
 */
export const RELEASE_NOTES: Record<string, string[]> = {
  '0.1.7': [
    'Added this “What’s New” dialog — a quick summary of fixes and changes after each update.'
  ],
  '0.1.6': [
    'Fixed playback freezing about a minute in (Direct Play streams now reconnect automatically).',
    'Fixed the progress bar not advancing during playback.',
    'Fixed the progress bar getting stuck or snapping back after dragging to seek.',
    'Added a “Watch from Start” button on items that have a resume point.'
  ]
}
