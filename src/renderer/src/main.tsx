import ReactDOM from 'react-dom/client'
import App from './App'
import { PlayerOverlay } from './components/PlayerOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'
import { applyTheme, getStoredThemeId } from './lib/themes'

// Apply the saved theme before the first paint to avoid a color flash.
applyTheme(getStoredThemeId(), false)

// This page is loaded both as the main app and (with ?overlay=1) as the
// transparent player-controls overlay window.
const isOverlay = new URLSearchParams(window.location.search).has('overlay')

// Note: StrictMode is intentionally omitted — its dev double-invocation of
// effects double-starts side-effectful playback (spawns mpv twice).
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  isOverlay ? (
    <ErrorBoundary overlay>
      <PlayerOverlay />
    </ErrorBoundary>
  ) : (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
)
