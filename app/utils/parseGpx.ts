import type { ActivityStream, TrackPoint } from './activity'

function textOf(el: Element | null): string | undefined {
  const v = el?.textContent?.trim()
  return v || undefined
}

function numOf(el: Element | null): number | undefined {
  const v = textOf(el)
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function localName(tag: string): string {
  const parts = tag.split(':')
  return (parts[parts.length - 1] || tag).toLowerCase()
}

function findExt(extRoot: Element | null, localNames: string[]): number | undefined {
  if (!extRoot) return undefined
  const wanted = new Set(localNames.map((n) => n.toLowerCase()))

  const walk = (node: Element): number | undefined => {
    const name = localName(node.tagName)
    if (wanted.has(name)) {
      const n = Number(node.textContent?.trim())
      if (Number.isFinite(n)) return n
    }
    for (const child of Array.from(node.children)) {
      const found = walk(child as Element)
      if (found != null) return found
    }
    return undefined
  }

  return walk(extRoot)
}

export function parseGpx(xml: string, sourceLabel = 'gpx'): ActivityStream {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GPX file')
  }

  const trk = doc.querySelector('trk')
  const name =
    textOf(trk?.querySelector('name') ?? null) ||
    textOf(doc.querySelector('metadata > name') ?? null) ||
    'Merged activity'
  const sport = textOf(trk?.querySelector('type') ?? null) || 'running'

  const trkpts = Array.from(doc.getElementsByTagName('trkpt'))
  const points: TrackPoint[] = []

  for (const trkpt of trkpts) {
    const timeStr = textOf(trkpt.querySelector('time'))
    if (!timeStr) continue
    const t = Date.parse(timeStr)
    if (!Number.isFinite(t)) continue

    const lat = Number(trkpt.getAttribute('lat'))
    const lon = Number(trkpt.getAttribute('lon'))
    const ele = numOf(trkpt.querySelector('ele'))
    const extensions = trkpt.querySelector('extensions')

    const point: TrackPoint = {
      t,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      ele,
      hr: findExt(extensions, ['hr', 'heartrate', 'HeartRateBpm']),
      cad: findExt(extensions, ['cad', 'cadence']),
      power: findExt(extensions, ['power', 'PowerInWatts']),
      temp: findExt(extensions, ['atemp', 'temp']),
      speed: findExt(extensions, ['speed']),
    }
    points.push(point)
  }

  points.sort((a, b) => a.t - b.t)

  if (!points.length) {
    throw new Error('GPX has no timed track points')
  }

  return { name, sport, sourceLabel, points }
}

export async function parseGpxFile(file: File, sourceLabel?: string): Promise<ActivityStream> {
  const text = await file.text()
  return parseGpx(text, sourceLabel ?? file.name)
}
