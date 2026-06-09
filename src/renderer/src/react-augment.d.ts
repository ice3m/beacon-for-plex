import 'react'

// Electron frameless-window drag regions are set via this non-standard CSS
// property; declaring it here lets us use it without casts.
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
