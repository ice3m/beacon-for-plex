/** Streaming quality presets, mirroring Plex's quality menu. */
export interface QualityOption {
  id: string
  label: string
  /** Max video bitrate in kbps; omitted for Original (direct play). */
  maxBitrate?: number
  width?: number
  height?: number
}

export const QUALITIES: QualityOption[] = [
  { id: 'original', label: 'Original (Maximum)' },
  { id: '1080-20', label: '1080p · 20 Mbps', maxBitrate: 20000, width: 1920, height: 1080 },
  { id: '1080-12', label: '1080p · 12 Mbps', maxBitrate: 12000, width: 1920, height: 1080 },
  { id: '1080-8', label: '1080p · 8 Mbps', maxBitrate: 8000, width: 1920, height: 1080 },
  { id: '720-4', label: '720p · 4 Mbps', maxBitrate: 4000, width: 1280, height: 720 },
  { id: '720-3', label: '720p · 3 Mbps', maxBitrate: 3000, width: 1280, height: 720 },
  { id: '720-2', label: '720p · 2 Mbps', maxBitrate: 2000, width: 1280, height: 720 },
  { id: '480-1.5', label: '480p · 1.5 Mbps', maxBitrate: 1500, width: 848, height: 480 },
  { id: '360-0.7', label: '360p · 0.7 Mbps', maxBitrate: 720, width: 640, height: 360 }
]

export const DEFAULT_QUALITY = 'original'

export function qualityById(id: string): QualityOption {
  return QUALITIES.find((q) => q.id === id) ?? QUALITIES[0]
}
