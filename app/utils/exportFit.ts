import { Encoder, Profile } from '@garmin/fitsdk'
import type { ActivityLap, ActivityStream, TrackPoint } from './activity'
import { haversineMeters, hasGps } from './activity'

function degToSemicircles(deg: number): number {
  return Math.round(deg * (2 ** 31 / 180))
}

function pathDistance(points: TrackPoint[]): number {
  let distance = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (!hasGps(a) || !hasGps(b)) continue
    distance += haversineMeters(a.lat!, a.lon!, b.lat!, b.lon!)
  }
  return distance
}

function pointsInWindow(
  points: TrackPoint[],
  startTime: number,
  endTime: number,
): TrackPoint[] {
  return points.filter((p) => p.t >= startTime && p.t <= endTime)
}

function normalizeLaps(
  stream: ActivityStream,
  points: TrackPoint[],
): ActivityLap[] {
  const activityStart = points[0]!.t
  const activityEnd = points[points.length - 1]!.t
  const source = stream.laps?.length
    ? stream.laps
    : [
        {
          startTime: activityStart,
          endTime: activityEnd,
          trigger: 'sessionEnd',
        },
      ]

  const laps: ActivityLap[] = []
  for (const lap of source) {
    const startTime = Math.max(activityStart, Math.min(lap.startTime, activityEnd))
    const endTime = Math.max(startTime, Math.min(lap.endTime, activityEnd))
    const window = pointsInWindow(points, startTime, endTime)
    if (window.length < 1) continue

    const elapsedSec = Math.max(1, (endTime - startTime) / 1000)
    const timerSec =
      typeof lap.totalTimerTime === 'number' && lap.totalTimerTime > 0
        ? lap.totalTimerTime
        : elapsedSec

    laps.push({
      startTime,
      endTime,
      trigger: lap.trigger,
      totalDistance: pathDistance(window),
      totalElapsedTime: elapsedSec,
      totalTimerTime: timerSec,
    })
  }

  if (!laps.length) {
    const elapsed = Math.max(1, (activityEnd - activityStart) / 1000)
    laps.push({
      startTime: activityStart,
      endTime: activityEnd,
      trigger: 'sessionEnd',
      totalDistance: pathDistance(points),
      totalElapsedTime: elapsed,
      totalTimerTime: elapsed,
    })
  }

  return laps
}

export function exportFit(stream: ActivityStream): Uint8Array {
  const points = stream.points.filter(hasGps)
  if (!points.length) {
    throw new Error('No GPS points to export as FIT')
  }

  const start = points[0]!
  const end = points[points.length - 1]!
  const startDate = new Date(start.t)
  const endDate = new Date(end.t)
  const distance = pathDistance(points)
  const elapsed = Math.max(1, (end.t - start.t) / 1000)
  const laps = normalizeLaps(stream, points)

  const encoder = new Encoder()

  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    product: 1,
    timeCreated: startDate,
  })

  encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
    timestamp: startDate,
    deviceIndex: 0,
    manufacturer: 'development',
    product: 1,
  })

  const sport = stream.sport?.toLowerCase().includes('cycl')
    ? 'cycling'
    : stream.sport?.toLowerCase().includes('walk')
      ? 'walking'
      : 'running'

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startDate,
    event: 'timer',
    eventType: 'start',
    eventGroup: 0,
  })

  for (const p of points) {
    const rec: Record<string, unknown> = {
      timestamp: new Date(p.t),
      positionLat: degToSemicircles(p.lat!),
      positionLong: degToSemicircles(p.lon!),
    }
    if (typeof p.ele === 'number') {
      rec.altitude = p.ele
      rec.enhancedAltitude = p.ele
    }
    if (typeof p.hr === 'number') rec.heartRate = Math.round(p.hr)
    if (typeof p.cad === 'number') rec.cadence = Math.round(p.cad)
    if (typeof p.power === 'number') rec.power = Math.round(p.power)
    if (typeof p.speed === 'number') {
      rec.speed = p.speed
      rec.enhancedSpeed = p.speed
    }
    if (typeof p.temp === 'number') rec.temperature = Math.round(p.temp)
    encoder.onMesg(Profile.MesgNum.RECORD, rec)
  }

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: endDate,
    event: 'timer',
    eventType: 'stopAll',
    eventGroup: 0,
  })

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i]!
    const isLast = i === laps.length - 1
    const trigger =
      lap.trigger === 'manual' ||
      lap.trigger === 'distance' ||
      lap.trigger === 'time' ||
      lap.trigger === 'position' ||
      lap.trigger === 'sessionEnd'
        ? lap.trigger
        : isLast
          ? 'sessionEnd'
          : 'manual'

    encoder.onMesg(Profile.MesgNum.LAP, {
      timestamp: new Date(lap.endTime),
      startTime: new Date(lap.startTime),
      totalElapsedTime: lap.totalElapsedTime ?? Math.max(1, (lap.endTime - lap.startTime) / 1000),
      totalTimerTime: lap.totalTimerTime ?? lap.totalElapsedTime ?? 1,
      totalDistance: lap.totalDistance ?? 0,
      sport,
      lapTrigger: trigger,
      event: 'lap',
      eventType: 'stop',
    })
  }

  encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: endDate,
    startTime: startDate,
    totalElapsedTime: elapsed,
    totalTimerTime: elapsed,
    totalDistance: distance,
    sport,
    subSport: 'generic',
    firstLapIndex: 0,
    numLaps: laps.length,
    event: 'session',
    eventType: 'stop',
  })

  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: endDate,
    totalTimerTime: elapsed,
    numSessions: 1,
    type: 'manual',
    event: 'activity',
    eventType: 'stop',
  })

  return encoder.close()
}

export function downloadFit(stream: ActivityStream, filename?: string): void {
  const bytes = exportFit(stream)
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${stream.name.replace(/\s+/g, '_')}_merged.fit`
  a.click()
  URL.revokeObjectURL(url)
}
