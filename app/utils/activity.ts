export type MetricKey = 'gps' | 'ele' | 'hr' | 'cad' | 'power' | 'speed' | 'temp'

export interface TrackPoint {
  t: number
  lat?: number
  lon?: number
  ele?: number
  hr?: number
  cad?: number
  power?: number
  speed?: number
  temp?: number
}

export interface ActivityStream {
  name: string
  sport: string
  sourceLabel: string
  points: TrackPoint[]
}

export interface ChannelScore {
  channel: MetricKey
  score: number
  coverage: number
  reason: string
  present: boolean
}

export interface ActivityScores {
  channels: ChannelScore[]
  available: MetricKey[]
}

export type SourceChoice = 'phone' | 'watch'

export interface MergeChoices {
  gps: SourceChoice
  ele: SourceChoice
  hr?: SourceChoice
  cad?: SourceChoice
  power?: SourceChoice
  speed?: SourceChoice
  temp?: SourceChoice
  stripTeleports: boolean
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  gps: 'GPS',
  ele: 'Elevation',
  hr: 'Heart rate',
  cad: 'Cadence',
  power: 'Power',
  speed: 'Speed',
  temp: 'Temperature',
}

export function hasGps(p: TrackPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon)
}

export function channelPresent(points: TrackPoint[], channel: MetricKey): boolean {
  if (channel === 'gps') return points.some(hasGps)
  return points.some((p) => Number.isFinite(p[channel]))
}

export function durationMs(stream: ActivityStream): number {
  if (stream.points.length < 2) return 0
  return stream.points[stream.points.length - 1]!.t - stream.points[0]!.t
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
