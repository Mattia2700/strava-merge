import {
  type ActivityScores,
  type ActivityStream,
  type ChannelScore,
  type MetricKey,
  channelPresent,
  haversineMeters,
  hasGps,
} from './activity'

const CHANNELS: MetricKey[] = ['gps', 'ele', 'hr', 'cad', 'power', 'speed', 'temp']

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Fraction of activity time that has samples without long gaps. */
function timeCoverage(sampleTimes: number[], start: number, end: number, maxGapMs = 2500): number {
  const totalMs = end - start
  if (totalMs <= 0 || !sampleTimes.length) return 0

  let coveredMs = 0
  for (let i = 1; i < sampleTimes.length; i++) {
    const dt = sampleTimes[i]! - sampleTimes[i - 1]!
    if (dt > 0 && dt <= maxGapMs) coveredMs += dt
  }

  // Lead/trail: credit if first/last samples sit near activity bounds
  const lead = sampleTimes[0]! - start
  if (lead > 0 && lead <= maxGapMs) coveredMs += lead
  const trail = end - sampleTimes[sampleTimes.length - 1]!
  if (trail > 0 && trail <= maxGapMs) coveredMs += trail

  return Math.max(0, Math.min(1, coveredMs / totalMs))
}

function activityBounds(stream: ActivityStream): { start: number; end: number } {
  const first = stream.points[0]?.t ?? 0
  const last = stream.points[stream.points.length - 1]?.t ?? first
  return { start: first, end: last }
}

function scoreGps(stream: ActivityStream): ChannelScore {
  const { start, end } = activityBounds(stream)
  const withGps = stream.points.filter(hasGps)
  const sampleTimes = withGps.map((p) => p.t)
  const coverage = timeCoverage(sampleTimes, start, end)

  if (!withGps.length) {
    return {
      channel: 'gps',
      score: 0,
      coverage: 0,
      present: false,
      reason: 'No GPS points',
    }
  }

  const steps: number[] = []
  let jumps = 0
  let gaps = 0

  for (let i = 1; i < withGps.length; i++) {
    const a = withGps[i - 1]!
    const b = withGps[i]!
    const dt = (b.t - a.t) / 1000
    if (dt > 5) gaps++
    if (dt <= 0) continue
    const d = haversineMeters(a.lat!, a.lon!, b.lat!, b.lon!)
    steps.push(d)
    if (d / dt > 20) jumps++
  }

  const meanStep = mean(steps)
  const maxStep = steps.length ? Math.max(...steps) : 0
  let score = 100 * coverage
  score -= Math.min(40, jumps * 8)
  score -= Math.min(15, gaps * 2)
  if (meanStep > 8) score -= 10
  if (maxStep > 50) score -= 15
  score = clamp(score)

  const parts = [
    `${Math.round(coverage * 100)}% of activity time`,
    `${withGps.length} GPS fixes`,
    jumps ? `${jumps} jump${jumps === 1 ? '' : 's'}` : 'no big jumps',
    `avg step ${meanStep.toFixed(1)}m`,
  ]

  return {
    channel: 'gps',
    score,
    coverage,
    present: true,
    reason: parts.join(' · '),
  }
}

function scoreSeries(
  stream: ActivityStream,
  channel: Exclude<MetricKey, 'gps'>,
  opts: { min: number; max: number; zeroIsBad?: boolean },
): ChannelScore {
  const { start, end } = activityBounds(stream)
  const samples = stream.points.filter(
    (p) => typeof p[channel] === 'number' && Number.isFinite(p[channel]),
  )
  const values = samples.map((p) => p[channel] as number)
  const sampleTimes = samples.map((p) => p.t)
  const coverage = timeCoverage(sampleTimes, start, end)

  if (!values.length) {
    return {
      channel,
      score: 0,
      coverage: 0,
      present: false,
      reason: 'Not present',
    }
  }

  let spikes = 0
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i]! - values[i - 1]!) > (opts.max - opts.min) * 0.35) {
      spikes++
    }
  }

  const outOfRange = values.filter((v) => v < opts.min || v > opts.max).length
  const zeros = values.filter((v) => v === 0).length
  const zeroRatio = zeros / values.length

  let score = 100 * coverage
  score -= Math.min(25, (spikes / Math.max(1, values.length)) * 100)
  score -= Math.min(25, (outOfRange / values.length) * 100)
  if (opts.zeroIsBad && zeroRatio > 0.05) {
    score -= Math.min(30, zeroRatio * 60)
  }
  score = clamp(score)

  const parts = [
    `${Math.round(coverage * 100)}% of activity time`,
    `range ${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)}`,
  ]
  if (spikes) parts.push(`${spikes} spike${spikes === 1 ? '' : 's'}`)
  if (opts.zeroIsBad && zeros) parts.push(`${zeros} zeros`)

  return {
    channel,
    score,
    coverage,
    present: true,
    reason: parts.join(' · '),
  }
}

export function scoreActivity(stream: ActivityStream): ActivityScores {
  const channels: ChannelScore[] = [
    scoreGps(stream),
    scoreSeries(stream, 'ele', { min: -400, max: 9000 }),
    scoreSeries(stream, 'hr', { min: 35, max: 230 }),
    scoreSeries(stream, 'cad', { min: 0, max: 240, zeroIsBad: true }),
    scoreSeries(stream, 'power', { min: 0, max: 2500, zeroIsBad: true }),
    scoreSeries(stream, 'speed', { min: 0, max: 40 }),
    scoreSeries(stream, 'temp', { min: -30, max: 55 }),
  ]

  const available = CHANNELS.filter((c) => channelPresent(stream.points, c))
  return { channels, available }
}

export function getChannelScore(
  scores: ActivityScores,
  channel: MetricKey,
): ChannelScore {
  return (
    scores.channels.find((c) => c.channel === channel) ?? {
      channel,
      score: 0,
      coverage: 0,
      present: false,
      reason: 'Missing',
    }
  )
}

export function recommendSource(
  phone: ChannelScore,
  watch: ChannelScore,
): 'phone' | 'watch' {
  if (!phone.present && watch.present) return 'watch'
  if (phone.present && !watch.present) return 'phone'
  if (watch.score > phone.score + 5) return 'watch'
  return 'phone'
}
