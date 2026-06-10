/**
 * Per-version "What's New" notes, shown once after the app updates to a given
 * version (see `updates.whatsNew`). Add a new entry for each release; keep each
 * item short and user-facing (a single fix/change per bullet).
 */
export const RELEASE_NOTES: Record<string, string[]> = {
  '0.1.13': [
    'Fixed the app sometimes opening fullscreen with no way out — it no longer reopens fullscreen, and F11 toggles / Escape exits a fullscreen window.',
    'While watching, Escape now just exits fullscreen (back to the windowed player) instead of shrinking to the mini-player.'
  ],
  '0.1.12': [
    'Playback recovery no longer interrupts you: if a stream is recovering and you start something else, your new pick is kept.',
    'Internal reliability cleanups around stream recovery and logging.'
  ],
  '0.1.10': [
    'Frozen streams now actually recover: playback reconnects on a fresh player and resumes from where it stalled, instead of getting stuck.',
    'If a stream genuinely can’t be loaded, you now get a clear error with “Try again” instead of an endless Loading screen.'
  ],
  '0.1.9': [
    'More robust recovery from dropped streams: playback that stalls mid-stream now auto-resumes from where it froze, even when no error is reported.'
  ],
  '0.1.8': [
    'Fixed playback dropping mid-stream (often right after seeking, especially on remote connections) — the app now reconnects and resumes from where it left off automatically.',
    'If a stream fails to start, you now get a “Try again” option instead of an endless Loading screen.'
  ],
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
