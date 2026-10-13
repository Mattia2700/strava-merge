import type { ActivityStream, TrackPoint } from './activity'

/** FIT timestamps are seconds since 1989-12-31, not Unix. */
const FIT_EPOCH_MS = 631_065_600_000

function toMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Already Unix milliseconds
    if (value > 1e12) return value
    // Decoder number = FIT datetime (seconds since FIT epoch)
    return value * 1000 + FIT_EPOCH_MS
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : undefined
  }
  return undefined
}

function semicirclesToDeg(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (Math.abs(value) <= 180) return value
  return value * (180 / 2 ** 31)
}

export async function parseFitBuffer(
  buffer: ArrayBuffer,
  sourceLabel = 'fit',
): Promise<ActivityStream> {
  // Dynamic import keeps the huge FIT profile off the initial page load.
  const { Decoder, Stream } = await import('@garmin/fitsdk')

  // Own copy avoids odd byteOffset views from File/Blob backends.
  const bytes = new Uint8Array(buffer)
  const copy = bytes.slice()
  const stream = Stream.fromArrayBuffer(copy.buffer)
  const decoder = new Decoder(stream)

  if (!decoder.isFIT()) {
    throw new Error('Not a valid FIT file')
  }

  // Lean options: faster decode, less main-thread jank on watch files.
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: false,
    expandComponents: false,
    convertTypesToStrings: true,
    // Prefer Date objects so we never confuse FIT-epoch seconds with Unix time.
    convertDateTimesToDates: true,
    mergeHeartRates: false,
    includeUnknownData: false,
  })

  if (errors?.length) {
    console.warn('FIT decode warnings', errors)
  }

  const records = (messages?.recordMesgs ?? []) as Array<Record<string, unknown>>
  const sessions = (messages?.sessionMesgs ?? []) as Array<Record<string, unknown>>
  const sports = (messages?.sportMesgs ?? []) as Array<Record<string, unknown>>
  const fileIds = (messages?.fileIdMesgs ?? []) as Array<Record<string, unknown>>

  const points: TrackPoint[] = []
  for (const rec of records) {
    const t = toMs(rec.timestamp)
    if (t == null) continue

    const lat = semicirclesToDeg(rec.positionLat ?? rec.position_lat)
    const lon = semicirclesToDeg(rec.positionLong ?? rec.position_long)

    const point: TrackPoint = { t }
    if (lat != null) point.lat = lat
    if (lon != null) point.lon = lon

    const ele = rec.enhancedAltitude ?? rec.altitude
    if (typeof ele === 'number' && Number.isFinite(ele)) point.ele = ele

    const hr = rec.heartRate ?? rec.heart_rate
    if (typeof hr === 'number' && Number.isFinite(hr)) point.hr = hr

    const cad = rec.cadence
    if (typeof cad === 'number' && Number.isFinite(cad)) point.cad = cad

    const power = rec.power
    if (typeof power === 'number' && Number.isFinite(power)) point.power = power

    const speed = rec.enhancedSpeed ?? rec.speed
    if (typeof speed === 'number' && Number.isFinite(speed)) point.speed = speed

    const temp = rec.temperature
    if (typeof temp === 'number' && Number.isFinite(temp)) point.temp = temp

    points.push(point)
  }

  points.sort((a, b) => a.t - b.t)

  if (!points.length) {
    throw new Error('FIT file has no record messages with timestamps')
  }

  const session = sessions[0] ?? {}
  const sportMsg = sports[0] ?? {}
  const sport =
    String(session.sport ?? sportMsg.sport ?? 'running').toLowerCase() || 'running'
  const name =
    String(session.name ?? fileIds[0]?.productName ?? sourceLabel) || 'FIT activity'

  return { name, sport, sourceLabel, points }
}

export async function parseFitFile(
  file: File,
  sourceLabel?: string,
): Promise<ActivityStream> {
  const buffer = await file.arrayBuffer()
  // Let the "Parsing…" label paint before the sync decode blocks.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
  return parseFitBuffer(buffer, sourceLabel ?? file.name)
}
