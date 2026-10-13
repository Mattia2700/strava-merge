import { Encoder, Profile } from '@garmin/fitsdk'
import type { ActivityStream } from './activity'
import { haversineMeters, hasGps } from './activity'

function degToSemicircles(deg: number): number {
  return Math.round(deg * (2 ** 31 / 180))
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

  let distance = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    distance += haversineMeters(a.lat!, a.lon!, b.lat!, b.lon!)
  }

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

  const elapsed = Math.max(1, (end.t - start.t) / 1000)

  encoder.onMesg(Profile.MesgNum.LAP, {
    timestamp: endDate,
    startTime: startDate,
    totalElapsedTime: elapsed,
    totalTimerTime: elapsed,
    totalDistance: distance,
    sport,
  })

  encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: endDate,
    startTime: startDate,
    totalElapsedTime: elapsed,
    totalTimerTime: elapsed,
    totalDistance: distance,
    sport,
    subSport: 'generic',
    firstLapIndex: 0,
    numLaps: 1,
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
