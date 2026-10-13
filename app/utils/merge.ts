import {
  type ActivityStream,
  type MergeChoices,
  type MetricKey,
  type SourceChoice,
  type TrackPoint,
  haversineMeters,
  hasGps,
} from './activity'
import { getChannelScore, recommendSource, scoreActivity } from './score'

type NumericField = Exclude<MetricKey, 'gps'>

const NUMERIC_FIELDS: NumericField[] = [
  'ele',
  'hr',
  'cad',
  'power',
  'speed',
  'temp',
]

interface FieldIndex {
  times: number[]
  values: number[]
}

function nearestIndex(times: number[], t: number): number {
  let lo = 0
  let hi = times.length - 1
  if (t <= times[0]!) return 0
  if (t >= times[hi]!) return hi
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = times[mid]!
    if (v === t) return mid
    if (v < t) lo = mid + 1
    else hi = mid - 1
  }
  const after = lo
  const before = Math.max(0, lo - 1)
  return Math.abs(times[after]! - t) < Math.abs(times[before]! - t) ? after : before
}

function buildFieldIndex(
  points: TrackPoint[],
  field: NumericField,
): FieldIndex | null {
  const times: number[] = []
  const values: number[] = []
  for (const p of points) {
    const value = p[field]
    if (typeof value === 'number' && Number.isFinite(value)) {
      times.push(p.t)
      values.push(value)
    }
  }
  return times.length ? { times, values } : null
}

function buildGpsIndex(points: TrackPoint[]) {
  const times: number[] = []
  const coords: Array<{ lat: number; lon: number; ele?: number }> = []
  for (const p of points) {
    if (!hasGps(p)) continue
    times.push(p.t)
    coords.push({ lat: p.lat!, lon: p.lon!, ele: p.ele })
  }
  return times.length ? { times, coords } : null
}

function sampleIndexed(
  index: FieldIndex | null,
  t: number,
  maxDt = 5000,
): number | undefined {
  if (!index) return undefined
  const idx = nearestIndex(index.times, t)
  if (Math.abs(index.times[idx]! - t) > maxDt) return undefined
  return index.values[idx]
}

function sampleIndexedGps(
  index: ReturnType<typeof buildGpsIndex>,
  t: number,
  maxDt = 5000,
): Pick<TrackPoint, 'lat' | 'lon' | 'ele'> | undefined {
  if (!index) return undefined
  const idx = nearestIndex(index.times, t)
  if (Math.abs(index.times[idx]! - t) > maxDt) return undefined
  return index.coords[idx]
}

function stripTeleportJumps(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 3) return points
  const keep = points.map(() => true)

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const next = points[i + 1]!
    if (!hasGps(prev) || !hasGps(cur) || !hasGps(next)) continue

    const d1 = haversineMeters(prev.lat!, prev.lon!, cur.lat!, cur.lon!)
    const d2 = haversineMeters(cur.lat!, cur.lon!, next.lat!, next.lon!)
    const dSkip = haversineMeters(prev.lat!, prev.lon!, next.lat!, next.lon!)
    const dt1 = (cur.t - prev.t) / 1000
    const dt2 = (next.t - cur.t) / 1000

    const spikeOut =
      dt1 > 0 &&
      d1 / dt1 > 20 &&
      d2 / Math.max(dt2, 0.001) > 20 &&
      dSkip < Math.min(d1, d2) * 0.5

    const huge = d1 > 50 && d2 > 50 && dSkip < 25
    if (spikeOut || huge) keep[i] = false
  }

  return points.filter((_, i) => keep[i])
}

function uniqueSorted(points: TrackPoint[]): TrackPoint[] {
  const byTime = new Map<number, TrackPoint>()
  for (const p of points) {
    if (!Number.isFinite(p.t)) continue
    byTime.set(p.t, p)
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t)
}

/** Prefer ~1Hz GPS timeline so merge stays tight and Strava-friendly. */
function baseTimeline(phone: ActivityStream): TrackPoint[] {
  const gpsPoints = phone.points.filter(hasGps)
  if (gpsPoints.length >= 2) return gpsPoints
  return phone.points
}

export interface SharedChannelDecision {
  channel: 'gps' | 'ele' | 'hr' | 'cad' | 'power' | 'speed' | 'temp'
  phonePresent: boolean
  watchPresent: boolean
  shared: boolean
  phoneScore: number
  watchScore: number
  phoneReason: string
  watchReason: string
  recommended: SourceChoice
}

export function analyzeOverlap(
  phone: ActivityStream,
  watch: ActivityStream,
): SharedChannelDecision[] {
  const phoneScores = scoreActivity(phone)
  const watchScores = scoreActivity(watch)
  const channels: MetricKey[] = [
    'gps',
    'ele',
    'hr',
    'cad',
    'power',
    'speed',
    'temp',
  ]

  return channels.map((channel) => {
    const p = getChannelScore(phoneScores, channel)
    const w = getChannelScore(watchScores, channel)
    return {
      channel,
      phonePresent: p.present,
      watchPresent: w.present,
      shared: p.present && w.present,
      phoneScore: p.score,
      watchScore: w.score,
      phoneReason: p.reason,
      watchReason: w.reason,
      recommended: recommendSource(p, w),
    }
  })
}

export function defaultMergeChoices(
  phone: ActivityStream,
  watch: ActivityStream,
): MergeChoices {
  const overlap = analyzeOverlap(phone, watch)
  const pick = (channel: MetricKey) =>
    overlap.find((o) => o.channel === channel)!.recommended

  const choices: MergeChoices = {
    gps: pick('gps'),
    ele: pick('ele'),
    stripTeleports: true,
  }

  for (const field of NUMERIC_FIELDS) {
    if (field === 'ele') continue
    const decision = overlap.find((o) => o.channel === field)!
    if (decision.shared || decision.phonePresent || decision.watchPresent) {
      choices[field] = decision.recommended
    }
  }

  return choices
}

function resolveFieldSource(
  field: NumericField,
  choices: MergeChoices,
  phonePresent: boolean,
  watchPresent: boolean,
): SourceChoice | null {
  if (phonePresent && watchPresent) {
    return choices[field] ?? 'phone'
  }
  if (phonePresent) return 'phone'
  if (watchPresent) return 'watch'
  return null
}

function indexBundle(stream: ActivityStream) {
  return {
    gps: buildGpsIndex(stream.points),
    fields: Object.fromEntries(
      NUMERIC_FIELDS.map((field) => [field, buildFieldIndex(stream.points, field)]),
    ) as Record<NumericField, FieldIndex | null>,
  }
}

export function mergeActivities(
  phone: ActivityStream,
  watch: ActivityStream,
  choices: MergeChoices,
): ActivityStream {
  const phoneScores = scoreActivity(phone)
  const watchScores = scoreActivity(watch)
  const phoneIdx = indexBundle(phone)
  const watchIdx = indexBundle(watch)
  const timeline = baseTimeline(phone)

  let points: TrackPoint[] = timeline.map((base) => {
    const out: TrackPoint = { t: base.t }

    const gpsIndex = choices.gps === 'phone' ? phoneIdx.gps : watchIdx.gps
    const gps = sampleIndexedGps(gpsIndex, base.t)
    if (gps) {
      out.lat = gps.lat
      out.lon = gps.lon
    }

    const eleSource = resolveFieldSource(
      'ele',
      choices,
      getChannelScore(phoneScores, 'ele').present,
      getChannelScore(watchScores, 'ele').present,
    )
    if (eleSource) {
      const ele = sampleIndexed(
        eleSource === 'phone' ? phoneIdx.fields.ele : watchIdx.fields.ele,
        base.t,
      )
      if (ele != null) out.ele = ele
    }

    for (const field of NUMERIC_FIELDS) {
      if (field === 'ele') continue
      const source = resolveFieldSource(
        field,
        choices,
        getChannelScore(phoneScores, field).present,
        getChannelScore(watchScores, field).present,
      )
      if (!source) continue
      const value = sampleIndexed(
        source === 'phone' ? phoneIdx.fields[field] : watchIdx.fields[field],
        base.t,
      )
      if (value != null) out[field] = value
    }

    return out
  })

  points = uniqueSorted(points).filter(hasGps)
  if (choices.stripTeleports) {
    points = stripTeleportJumps(points)
  }

  return {
    name: phone.name || watch.name || 'Merged activity',
    sport: phone.sport || watch.sport || 'running',
    sourceLabel: 'merged',
    points,
  }
}
